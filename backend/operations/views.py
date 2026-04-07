from rest_framework import viewsets, status, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import F
from .models import Resource, Event, Client, Ship, Port, Product, Agency, Operation
from .serializers import (
    ResourceSerializer, ClientSerializer, ShipSerializer, PortSerializer,
    ProductSerializer, AgencySerializer, OperationSerializer
)
from core.permissions import IsManagerOrAdmin
import logging
import csv
from django.http import HttpResponse
from django.utils import timezone
from .services import get_or_create_ship_from_imo, get_or_create_port_from_name

logger = logging.getLogger(__name__)


class ResourceViewSet(viewsets.ModelViewSet):
    """
    ViewSet para manejar la lógica de Recursos.
    Demuestra: Transacciones atómicas, pessimistic locking, F() expressions.
    """
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Queryset Security:
        Filtra querysets basados en el rol del usuario y ownership.
        """
        user = self.request.user
        if user.role in [user.Role.ADMIN, user.Role.MANAGER]:
            return Resource.objects.all()
        # Operadores o visualizadores solo ven sus propios recursos
        return Resource.objects.filter(owner=user)

    def perform_create(self, serializer):
        """
        Crea un recurso y registra un evento Outbox usando transacción atómica.
        """
        with transaction.atomic():
            resource = serializer.save(owner=self.request.user)

            # Transactional Outbox Pattern: guardar evento en misma transacción
            Event.objects.create(
                type="RESOURCE_CREATED",
                payload={"resource_id": str(resource.id), "name": resource.name}
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def update_stock(self, request, pk=None):
        """
        Endpoint que demuestra concurrencia y atomicidad para reducir el stock.
        """
        amount = int(request.data.get('amount', 1))

        try:
            with transaction.atomic():
                # Pessimistic Locking: select_for_update() asegura que otra trx no pueda modificar
                resource = Resource.objects.select_for_update().get(pk=pk)

                # Check business logic
                if resource.stock < amount:
                    return Response(
                        {"error": "Stock insuficiente"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Atomic Update: usar F expresion
                Resource.objects.filter(pk=resource.pk).update(stock=F('stock') - amount)

                # Outbox event
                Event.objects.create(
                    type="STOCK_UPDATED",
                    payload={"resource_id": str(resource.id), "amount_reduced": amount}
                )

            return Response({"status": "Stock updated and outbox event created."}, status=status.HTTP_200_OK)

        except Resource.DoesNotExist:
            return Response({"error": "No encontrado"}, status=status.HTTP_404_NOT_FOUND)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]


class ShipViewSet(viewsets.ModelViewSet):
    queryset = Ship.objects.all()
    serializer_class = ShipSerializer
    permission_classes = [permissions.IsAuthenticated]


class PortViewSet(viewsets.ModelViewSet):
    queryset = Port.objects.all()
    serializer_class = PortSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]


class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all()
    serializer_class = AgencySerializer
    permission_classes = [permissions.IsAuthenticated]


class OperationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para operaciones. Maneja todas las acciones que el frontend espera.
    """
    queryset = Operation.objects.all().select_related(
        'client', 'ship', 'port', 'agency'
    ).prefetch_related('products__product')
    serializer_class = OperationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    # Usamos 'estado' porque el modelo tiene FSMField llamado 'estado'
    filterset_fields = ['client', 'ship', 'port', 'estado']
    search_fields = ['client__name', 'ship__name', 'notes']
    ordering_fields = ['eta', 'created_at']

    # ========== ACCIONES DE ESTADO (usando las transiciones FSM del modelo) ==========
    @action(detail=True, methods=['post'])
    def confirm_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.confirm()   # Asume que el modelo tiene el método confirm() decorado con @transition
            op.save()
            return Response({'status': 'confirmed'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def start_coordination(self, request, pk=None):
        op = self.get_object()
        try:
            op.start_coordination()
            op.save()
            return Response({'status': 'in_coordination'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        op = self.get_object()
        try:
            op.mark_delivered()
            op.save()
            return Response({'status': 'delivered'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def close_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.close()
            op.save()
            return Response({'status': 'closed'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel_operation(self, request, pk=None):
        op = self.get_object()
        if op.estado in [Operation.ESTADO_ENTREGADA, Operation.ESTADO_CANCELADA]:
            return Response(
                {'error': 'No se puede cancelar una operación ya cerrada o cancelada'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            op.cancel()
            op.save()
            return Response({'status': 'cancelled'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ========== MANEJO DE ARCHIVOS ==========
    @action(detail=True, methods=['post'])
    def upload_packing(self, request, pk=None):
        op = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        op.packing_list_file = file
        op.save()
        return Response({'status': 'packing uploaded'})

    @action(detail=True, methods=['post'])
    def upload_remito(self, request, pk=None):
        op = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        op.remito_file = file
        op.save()
        return Response({'status': 'remito uploaded'})

    @action(detail=True, methods=['post'])
    def upload_rancho(self, request, pk=None):
        op = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        op.rancho_file = file
        op.save()
        return Response({'status': 'rancho uploaded'})

    @action(detail=True, methods=['delete'])
    def delete_packing(self, request, pk=None):
        op = self.get_object()
        if op.packing_list_file:
            op.packing_list_file.delete(save=False)
            op.packing_list_file = None
            op.save()
        return Response({'status': 'packing deleted'})

    @action(detail=True, methods=['delete'])
    def delete_remito(self, request, pk=None):
        op = self.get_object()
        if op.remito_file:
            op.remito_file.delete(save=False)
            op.remito_file = None
            op.save()
        return Response({'status': 'remito deleted'})

    @action(detail=True, methods=['delete'])
    def delete_rancho(self, request, pk=None):
        op = self.get_object()
        if op.rancho_file:
            op.rancho_file.delete(save=False)
            op.rancho_file = None
            op.save()
        return Response({'status': 'rancho deleted'})

    # ========== EXPORTACIONES ==========
    @action(detail=True, methods=['get'])
    def export_packing_csv(self, request, pk=None):
        op = self.get_object()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="packing_list_op_{op.id}.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Producto', 'Cantidad', 'Presentación', 'Peso unitario (kg)',
            'Peso total (kg)', 'Precio unitario', 'Total'
        ])
        total_weight = 0
        total_price = 0
        for op_prod in op.products.all():
            product = op_prod.product
            unit_weight = getattr(product, 'weight_kg', 0) or 0
            subtotal = op_prod.quantity * op_prod.unit_price
            total_weight += op_prod.quantity * unit_weight
            total_price += subtotal
            writer.writerow([
                product.name,
                op_prod.quantity,
                getattr(product, 'presentation', ''),
                unit_weight,
                op_prod.quantity * unit_weight,
                op_prod.unit_price,
                subtotal,
            ])
        writer.writerow([])
        writer.writerow(['TOTAL', '', '', '', total_weight, '', total_price])
        return response

    @action(detail=True, methods=['get'])
    def packing_list_json(self, request, pk=None):
        op = self.get_object()
        data = {
            'operation_id': op.id,
            'client': op.client.name,
            'ship': op.ship.name,
            'port': op.port.name,
            'eta': op.eta.isoformat() if op.eta else None,
            'products': [],
            'total_weight': 0,
            'total_price': 0,
        }
        total_weight = 0
        total_price = 0
        for op_prod in op.products.all():
            product = op_prod.product
            unit_weight = getattr(product, 'weight_kg', 0) or 0
            subtotal = op_prod.quantity * op_prod.unit_price
            total_weight += op_prod.quantity * unit_weight
            total_price += subtotal
            data['products'].append({
                'name': product.name,
                'quantity': op_prod.quantity,
                'presentation': getattr(product, 'presentation', ''),
                'unit_weight': unit_weight,
                'total_weight': op_prod.quantity * unit_weight,
                'unit_price': op_prod.unit_price,
                'subtotal': subtotal,
            })
        data['total_weight'] = total_weight
        data['total_price'] = total_price
        return Response(data)

    # ========== AUTOCOMPLETADO POR IMO ==========
    @action(detail=False, methods=['get'], url_path='auto_complete_imo')
    def auto_complete_imo(self, request):
        """
        GET ?imo=1234567
        Devuelve datos del buque y puerto de destino obtenidos por scraping.
        """
        imo = request.query_params.get('imo')
        if not imo or not imo.isdigit() or len(imo) != 7:
            return Response(
                {"error": "Se requiere un IMO válido de 7 dígitos"},
                status=status.HTTP_400_BAD_REQUEST
            )

        ship, scraped_data = get_or_create_ship_from_imo(imo)
        if not scraped_data:
            return Response(
                {"error": "No se pudo obtener información del buque. Verifique el IMO."},
                status=status.HTTP_404_NOT_FOUND
            )

        port = None
        port_id = None
        port_name = scraped_data.get('destino')
        if port_name:
            port = get_or_create_port_from_name(port_name)
            port_id = port.id if port else None

        response_data = {
            "ship_id": ship.id,
            "ship_name": ship.name,
            "flag": ship.flag,
            "imo": ship.imo,
            "eta": scraped_data.get('eta'),
            "eta_raw": scraped_data.get('eta_raw'),
            "port_id": port_id,
            "port_name": port_name,
        }
        return Response(response_data, status=status.HTTP_200_OK)
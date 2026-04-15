from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.operaciones.models import Operacion, Client, Ship, Port, Agency
from apps.usuarios.models import User
from apps.operaciones.services import get_or_create_ship_from_imo, get_or_create_port_from_name

from .serializers import (
    OperacionSerializer, ClientSerializer, ShipSerializer,
    PortSerializer, AgencySerializer, OperacionDetalleSerializer
)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer


class ShipViewSet(viewsets.ModelViewSet):
    queryset = Ship.objects.all()
    serializer_class = ShipSerializer


class PortViewSet(viewsets.ModelViewSet):
    queryset = Port.objects.all()
    serializer_class = PortSerializer


class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all()
    serializer_class = AgencySerializer


class OperacionViewSet(viewsets.ModelViewSet):
    serializer_class = OperacionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Operacion.objects.all().select_related('cliente', 'ship', 'port', 'agency').prefetch_related('detalles')

        if user.role in [User.Role.OWNER, User.Role.CONTABLE]:
            return qs

        return qs.filter(
            Q(operadores_asignados=user) |
            Q(operarios_asignados=user) |
            Q(contables_asignados=user)
        ).distinct()

    @action(detail=False, methods=['get'])
    def dashboard_metrics(self, request):
        user = request.user
        if user.role not in [User.Role.OWNER, User.Role.CONTABLE]:
            return Response({'error': 'No autorizado'}, status=403)
            
        today = timezone.now().date()
        qs = Operacion.objects.all()
        
        # Básicos
        total = qs.count()
        en_proceso = qs.exclude(estado__in=[
            Operacion.ESTADO_ENTREGADA,
            Operacion.ESTADO_CANCELADA
        ]).count()
        finalizadas = qs.filter(estado=Operacion.ESTADO_ENTREGADA).count()
        usuarios_activos = User.objects.filter(is_active=True).count()
        
        return Response({
            'total': total,
            'en_proceso': en_proceso,
            'finalizadas': finalizadas,
            'usuarios_activos': usuarios_activos
        })

    @action(detail=False, methods=['get'])
    def holidays_ar(self, request):
        try:
            import holidays
            year = timezone.now().year
            ar_holidays = holidays.AR(years=[year, year+1])
            data = [{"date": str(date), "name": name} for date, name in ar_holidays.items()]
            return Response(data)
        except ImportError:
            return Response({'error': 'Librería holidays no instalada'}, status=500)

    @action(detail=True, methods=['post'])
    def cancel_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.cancel()
            op.save()
            return Response({'status': 'cancelled'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def confirm_operation(self, request, pk=None):
        """
        Confirmar operación: verifica stock y consume automáticamente
        """
        operacion = self.get_object()

        if operacion.estado != Operacion.ESTADO_SOLICITADA:
            return Response(
                {'error': f'La operación no está en estado SOLICITADA. Estado actual: {operacion.estado}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ok, errores = operacion.verificar_stock()
        if not ok:
            return Response({
                'error': 'Stock insuficiente para confirmar la operación',
                'detalles': errores
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                operacion.confirm()
                operacion.save()
                operacion.consumir_stock()
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': f'Error inesperado: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = self.get_serializer(operacion)
        return Response({
            'status': 'confirmed',
            'operation': serializer.data,
            'message': 'Operación confirmada y stock consumido correctamente'
        })

    # ========== NUEVAS ACCIONES PARA TRANSICIONES FALTANTES ==========
    @action(detail=True, methods=['post'])
    def start_coordination(self, request, pk=None):
        op = self.get_object()
        try:
            op.start_coordination()
            op.save()
            return Response({'status': 'coordination_started'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        op = self.get_object()
        try:
            op.mark_delivered()
            op.save()
            return Response({'status': 'delivered'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def close_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.close()
            op.save()
            return Response({'status': 'closed'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    # ========== ACCIONES PARA SUBIR ARCHIVOS ==========
    @action(detail=True, methods=['post'], url_path='upload_packing')
    def upload_packing(self, request, pk=None):
        op = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        op.packing_list_file = request.FILES['file']
        op.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='upload_remito')
    def upload_remito(self, request, pk=None):
        op = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        op.remito_file = request.FILES['file']
        op.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='upload_rancho')
    def upload_rancho(self, request, pk=None):
        op = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        op.rancho_file = request.FILES['file']
        op.save()
        return Response({'status': 'ok'})

    # ========== ENDPOINT PARA PACKING LIST JSON ==========
    @action(detail=True, methods=['get'], url_path='packing_list_json')
    def packing_list_json(self, request, pk=None):
        op = self.get_object()
        from apps.inventario.models import Articulo
        productos = []
        total_price = 0
        total_weight = 0
        for detalle in op.detalles.all():
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                subtotal = detalle.cantidad * float(detalle.precio_unitario)
                total_price += subtotal
                unit_weight = float(articulo.peso_kg)
                total_weight += detalle.cantidad * unit_weight
                productos.append({
                    'name': articulo.nombre,
                    'quantity': detalle.cantidad,
                    'presentation': articulo.presentacion,
                    'unit_weight': unit_weight,
                    'total_weight': detalle.cantidad * unit_weight,
                    'unit_price': float(detalle.precio_unitario),
                    'subtotal': subtotal,
                })
            except Articulo.DoesNotExist:
                productos.append({
                    'name': f"Artículo ID {detalle.articulo_id} (no existe)",
                    'quantity': detalle.cantidad,
                    'presentation': '',
                    'unit_weight': 0,
                    'total_weight': 0,
                    'unit_price': float(detalle.precio_unitario),
                    'subtotal': detalle.cantidad * float(detalle.precio_unitario),
                })
        data = {
            'operation_id': op.id,
            'client': op.cliente.name,
            'ship': op.ship.name,
            'port': op.port.name,
            'eta': op.eta,
            'products': productos,
            'total_price': total_price,
            'total_weight': total_weight,
        }
        return Response(data)

    @action(detail=True, methods=['get'])
    def verificar_stock(self, request, pk=None):
        operacion = self.get_object()
        ok, errores = operacion.verificar_stock()

        detalles_data = []
        for detalle in operacion.detalles.all():
            from apps.inventario.models import Articulo
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                detalles_data.append({
                    'id': detalle.id,
                    'articulo_id': detalle.articulo_id,
                    'nombre': articulo.nombre,
                    'presentacion': articulo.presentacion,
                    'cantidad_necesaria': detalle.cantidad,
                    'stock_actual': float(articulo.stock_actual),
                    'suficiente': articulo.stock_actual >= detalle.cantidad,
                    'error': None
                })
            except Articulo.DoesNotExist:
                detalles_data.append({
                    'id': detalle.id,
                    'articulo_id': detalle.articulo_id,
                    'nombre': f"ID {detalle.articulo_id}",
                    'presentacion': "",
                    'cantidad_necesaria': detalle.cantidad,
                    'stock_actual': 0,
                    'suficiente': False,
                    'error': "Producto no existe en inventario"
                })

        return Response({
            'operacion_id': operacion.id,
            'todo_suficiente': ok,
            'detalles': detalles_data,
            'errores': errores
        })

    @action(detail=False, methods=['get'], url_path='auto_complete_imo')
    def auto_complete_imo(self, request):
        imo = request.query_params.get('imo')

        if not imo or not imo.isdigit() or len(imo) != 7:
            return Response({"error": "Se requiere un IMO válido de 7 dígitos"}, status=400)

        ship, scraped_data = get_or_create_ship_from_imo(imo)

        if not scraped_data:
            return Response({"error": "No se pudo obtener información del buque."}, status=404)

        port = None
        port_id = None
        port_name = scraped_data.get('destino')

        if port_name:
            port = get_or_create_port_from_name(port_name)
            port_id = port.id if port else None

        return Response({
            "ship_id": ship.id,
            "ship_name": ship.name,
            "flag": ship.flag,
            "imo": ship.imo,
            "eta": scraped_data.get('eta'),
            "eta_raw": scraped_data.get('eta_raw'),
            "port_id": port_id,
            "port_name": port_name,
        })
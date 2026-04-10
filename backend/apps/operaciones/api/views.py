from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q

from apps.operaciones.models import Operacion, Client, Ship, Port, Agency
from apps.usuarios.models import User
from apps.operaciones.services import get_or_create_ship_from_imo, get_or_create_port_from_name

from .serializers import (
    OperacionSerializer, ClientSerializer, ShipSerializer, 
    PortSerializer, AgencySerializer
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
        qs = Operacion.objects.all().select_related('cliente', 'ship', 'port', 'agency')

        if user.role in [User.Role.OWNER, User.Role.CONTABLE]:
            return qs

        return qs.filter(
            Q(operadores_asignados=user) |
            Q(operarios_asignados=user) |
            Q(contables_asignados=user)
        ).distinct()

    @action(detail=True, methods=['post'])
    def cancel_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.cancel()
            op.save()
            return Response({'status': 'cancelled'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

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
# IMPORTANTE: Este archivo es estrictamente una Fachada (Anti-Corruption Layer) Temporal.
# Su único objetivo es traducir la nueva estructura a la versión vieja que consume el Frontend actual.
# DEBE SER ELIMINADO UNA VEZ REFACTORIZADO EL FRONTEND.
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from apps.operaciones.models import Operacion, OperacionDetalle

class OperacionCompatSerializer(serializers.ModelSerializer):
    """
    Serializador temporal para emular el modelo Operation monolítico antiguo.
    """
    client_name = serializers.CharField(source='cliente.name', read_only=True)
    ship_name = serializers.CharField(source='ship.name', read_only=True)
    port_name = serializers.CharField(source='port.name', read_only=True)
    
    # Mapeo de FSM a Front
    status = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()

    class Meta:
        model = Operacion
        fields = [
            'id', 'client_name', 'ship_name', 'port_name', 'eta',
            'delivery_method', 'status', 'products'
        ]

    def get_status(self, obj):
        # Mapea del nuevo FSM al frontend viejo temporalmente
        mapper = {
            Operacion.ESTADO_SOLICITADA: 'pending',
            Operacion.ESTADO_PRESUPUESTADA: 'price_checked',
            Operacion.ESTADO_EN_PRODUCCION: 'in_coordination',
            Operacion.ESTADO_LISTA_PARA_ENVIO: 'confirmed',
            Operacion.ESTADO_REMITADA: 'delivered',
            Operacion.ESTADO_ENTREGADA: 'closed',
            Operacion.ESTADO_CANCELADA: 'cancelled'
        }
        return mapper.get(obj.estado, 'pending')

    def get_products(self, obj):
        detalles = OperacionDetalle.objects.filter(operacion=obj)
        return [
            {
                "quantity": d.cantidad, 
                "unit_price": float(d.precio_unitario) if d.precio_unitario else 0
            } 
            for d in detalles
        ]

class OperacionCompatViewSet(viewsets.ModelViewSet):
    """
    ViewSet temporal para emular /api/operations/operations/
    """
    queryset = Operacion.objects.all().select_related('cliente', 'ship', 'port')
    serializer_class = OperacionCompatSerializer

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    from rest_framework.decorators import action
    @action(detail=True, methods=['post'])
    def cancel_operation(self, request, pk=None):
        op = self.get_object()
        op.estado = Operacion.ESTADO_CANCELADA
        op.save()
        return Response({'status': 'cancelled'})

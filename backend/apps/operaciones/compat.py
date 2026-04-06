# IMPORTANTE: Este archivo es estrictamente una Fachada (Anti-Corruption Layer) Temporal.
# Su único objetivo es traducir la nueva estructura a la versión vieja que consume el Frontend actual.
# DEBE SER ELIMINADO UNA VEZ REFACTORIZADO EL FRONTEND.
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from apps.operaciones.models import Operacion, OperacionDetalle, Client, Ship, Port, Agency
from apps.inventario.models import Articulo

class OperacionCompatSerializer(serializers.ModelSerializer):
    """
    Serializador temporal para emular el modelo Operation monolítico antiguo.
    """
    client_name = serializers.CharField(source='cliente.name', read_only=True)
    ship_name = serializers.CharField(source='ship.name', read_only=True)
    port_name = serializers.CharField(source='port.name', read_only=True)
    
    # Mapeo de FSM a Front
    status = serializers.SerializerMethodField(read_only=True)
    products = serializers.JSONField(required=False)

    class Meta:
        model = Operacion
        fields = [
            'id', 'client_name', 'ship_name', 'port_name', 'eta',
            'delivery_method', 'status', 'products',
            'cliente', 'ship', 'port', 'agency', 'notas'
        ]
        extra_kwargs = {
            'cliente': {'required': False},
            'ship': {'required': False},
            'port': {'required': False},
            'eta': {'required': False}, # Permisivo para creación rápida
        }

    def to_internal_value(self, data):
        import random
        # Trabajamos sobre una copia mutable para no alterar el request.data original
        mutable_data = data.copy() if hasattr(data, 'copy') else data
        
        def _get_or_create(field, model, defaults, name_field='name'):
            val = mutable_data.get(field)
            if val and isinstance(val, str) and not str(val).isdigit():
                params = {name_field: val, 'defaults': defaults}
                obj, _ = model.objects.get_or_create(**params)
                return obj.id
            return val

        # Mapeos Frontend -> Backend Model
        if 'client' in mutable_data:
            mutable_data['cliente'] = _get_or_create('client', Client, {'email': 'default@email.com'})
        
        if 'ship' in mutable_data:
            mutable_data['ship'] = _get_or_create('ship', Ship, {'imo': f'TBD{random.randint(1000, 9999)}', 'flag': 'TBD'})
            
        if 'port' in mutable_data:
            mutable_data['port'] = _get_or_create('port', Port, {'country': 'TBD'})
            
        if 'agency' in mutable_data:
            mutable_data['agency'] = _get_or_create('agency', Agency, {
                'email': 'default@email.com', 
                'contact_name': 'TBD', 
                'phone': '0'
            })
            
        if 'notes' in mutable_data:
            mutable_data['notas'] = mutable_data.pop('notes')

        # Si viene ETA vacío, evitamos error de validación para permitir guardado rápido
        if 'eta' in mutable_data and not mutable_data['eta']:
            mutable_data['eta'] = None

        return super().to_internal_value(mutable_data)

    def create(self, validated_data):
        products_data = validated_data.pop('products', [])
        # Manejamos los productos manualmente después de crear la operación
        operation = super().create(validated_data)
        self._handle_products(operation, products_data)
        return operation

    def update(self, instance, validated_data):
        products_data = validated_data.pop('products', None)
        operation = super().update(instance, validated_data)
        if products_data is not None:
            operation.detalles.all().delete()
            self._handle_products(operation, products_data)
        return operation

    def _handle_products(self, operation, products):
        for prod in products:
            p_val = prod.get('product')
            if p_val and isinstance(p_val, str) and not str(p_val).isdigit():
                articulo, _ = Articulo.objects.get_or_create(
                    nombre=p_val,
                    defaults={'presentacion': 'Unidad', 'peso_kg': 1.0}
                )
                articulo_id = articulo.id
            else:
                articulo_id = p_val
            
            if articulo_id:
                OperacionDetalle.objects.create(
                    operacion=operation,
                    articulo_id=articulo_id,
                    cantidad=prod.get('quantity', 0),
                    precio_unitario=prod.get('unit_price', 0)
                )

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

class ClientCompatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'email', 'contact_person', 'phone']

class ClientCompatViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientCompatSerializer

class ShipCompatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ship
        fields = ['id', 'name', 'imo', 'flag', 'call_sign', 'gross_tonnage']

class ShipCompatViewSet(viewsets.ModelViewSet):
    queryset = Ship.objects.all()
    serializer_class = ShipCompatSerializer

class PortCompatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Port
        fields = ['id', 'name', 'country', 'code']

class PortCompatViewSet(viewsets.ModelViewSet):
    queryset = Port.objects.all()
    serializer_class = PortCompatSerializer

class AgencyCompatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = ['id', 'name', 'contact_name', 'phone', 'email']

class AgencyCompatViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all()
    serializer_class = AgencyCompatSerializer

class ProductCompatSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='nombre', required=True)
    presentation = serializers.CharField(source='presentacion', required=False, allow_blank=True)
    weight_kg = serializers.DecimalField(source='peso_kg', max_digits=10, decimal_places=2, required=False)

    class Meta:
        model = Articulo
        fields = ['id', 'name', 'presentation', 'weight_kg']

class ProductCompatViewSet(viewsets.ModelViewSet):
    queryset = Articulo.objects.all()
    serializer_class = ProductCompatSerializer

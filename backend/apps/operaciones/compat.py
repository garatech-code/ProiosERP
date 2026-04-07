# IMPORTANTE: Fachada temporal (Anti-Corruption Layer). Eliminar cuando se refactorice el frontend.
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from apps.operaciones.models import Operacion, OperacionDetalle, Client, Ship, Port, Agency
from apps.inventario.models import Articulo
from .services import get_or_create_ship_from_imo, get_or_create_port_from_name
from rest_framework.decorators import action

class OperacionCompatSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='cliente.name', read_only=True)
    ship_name = serializers.CharField(source='ship.name', read_only=True)
    port_name = serializers.CharField(source='port.name', read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    products = serializers.JSONField(required=False)

    class Meta:
        model = Operacion
        fields = [
            'id', 'client_name', 'ship_name', 'port_name', 'eta',
            'delivery_method', 'status', 'products',
            'cliente', 'ship', 'port', 'agency', 'notas',
            'order_received_date', 'client_confirmed_date',
            'delivery_date', 'closed_date',
            'packing_list_file', 'remito_file', 'rancho_file',
        ]
        extra_kwargs = {
            'cliente': {'required': False},
            'ship': {'required': False},
            'port': {'required': False},
            'eta': {'required': False},
            'order_received_date': {'required': False, 'allow_null': True},
            'client_confirmed_date': {'required': False, 'allow_null': True},
            'delivery_date': {'required': False, 'allow_null': True},
            'closed_date': {'required': False, 'allow_null': True},
        }

    def to_representation(self, instance):
        """Asegura que el campo 'products' siempre sea una lista en la respuesta."""
        ret = super().to_representation(instance)
        ret['products'] = self.get_products(instance)
        return ret

    def get_products(self, obj):
        """Obtiene los productos asociados a la operación."""
        detalles = OperacionDetalle.objects.filter(operacion=obj)
        productos = []
        for detalle in detalles:
            # Como articulo_id es un IntegerField sin FK, buscamos el artículo manualmente
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                productos.append({
                    "product": detalle.articulo_id,
                    "product_name": articulo.nombre,
                    "quantity": detalle.cantidad,
                    "unit_price": float(detalle.precio_unitario) if detalle.precio_unitario else 0,
                    "weight_kg": float(articulo.peso_kg) if articulo.peso_kg else None,
                    "presentation": articulo.presentacion,
                })
            except Articulo.DoesNotExist:
                # Si no existe el artículo, devolvemos datos básicos
                productos.append({
                    "product": detalle.articulo_id,
                    "product_name": f"Artículo {detalle.articulo_id} (no encontrado)",
                    "quantity": detalle.cantidad,
                    "unit_price": float(detalle.precio_unitario) if detalle.precio_unitario else 0,
                    "weight_kg": None,
                    "presentation": "",
                })
        return productos

    def to_internal_value(self, data):
        import random
        mutable_data = data.copy() if hasattr(data, 'copy') else data

        def _get_or_create(field, model, defaults, name_field='name'):
            val = mutable_data.get(field)
            if val and isinstance(val, str) and not str(val).isdigit():
                params = {name_field: val, 'defaults': defaults}
                obj, _ = model.objects.get_or_create(**params)
                return obj.id
            return val

        if 'client' in mutable_data:
            mutable_data['cliente'] = _get_or_create('client', Client, {'email': 'default@email.com'})
        if 'ship' in mutable_data:
            mutable_data['ship'] = _get_or_create('ship', Ship, {'imo': f'TBD{random.randint(1000,9999)}', 'flag': 'TBD'})
        if 'port' in mutable_data:
            mutable_data['port'] = _get_or_create('port', Port, {'country': 'TBD'})
        if 'agency' in mutable_data:
            mutable_data['agency'] = _get_or_create('agency', Agency, {'email': 'default@email.com', 'contact_name': 'TBD', 'phone': '0'})
        if 'notes' in mutable_data:
            mutable_data['notas'] = mutable_data.pop('notes')
        if 'eta' in mutable_data and not mutable_data['eta']:
            mutable_data['eta'] = None

        return super().to_internal_value(mutable_data)

    def create(self, validated_data):
        products_data = validated_data.pop('products', [])
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


class OperacionCompatViewSet(viewsets.ModelViewSet):
    queryset = Operacion.objects.all().select_related('cliente', 'ship', 'port')
    serializer_class = OperacionCompatSerializer

    @action(detail=True, methods=['post'])
    def cancel_operation(self, request, pk=None):
        op = self.get_object()
        op.estado = Operacion.ESTADO_CANCELADA
        op.save()
        return Response({'status': 'cancelled'})

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
        return Response(response_data)


# Los siguientes ViewSets se mantienen igual (no se modifican)
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
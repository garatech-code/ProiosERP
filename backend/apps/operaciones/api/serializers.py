from rest_framework import serializers
from apps.operaciones.models import Operacion, OperacionDetalle, Client, Ship, Port, Agency
from apps.inventario.models import Articulo
from apps.usuarios.models import User
import json

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'email', 'contact_person', 'phone']

class ShipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ship
        fields = ['id', 'name', 'imo', 'flag', 'call_sign', 'gross_tonnage']

class PortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Port
        fields = ['id', 'name', 'country', 'code']

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = ['id', 'name', 'contact_name', 'phone', 'email']

class OperacionSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='cliente.name', read_only=True)
    ship_name = serializers.CharField(source='ship.name', read_only=True)
    port_name = serializers.CharField(source='port.name', read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    products = serializers.JSONField(required=False)

    operadores_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='operadores_asignados', required=False
    )
    operarios_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='operarios_asignados', required=False
    )
    contables_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='contables_asignados', required=False
    )

    class Meta:
        model = Operacion
        fields = [
            'id', 'client_name', 'ship_name', 'port_name', 'eta',
            'delivery_method', 'status', 'products',
            'cliente', 'ship', 'port', 'agency', 'notas',
            'order_received_date', 'client_confirmed_date',
            'delivery_date', 'closed_date',
            'packing_list_file', 'remito_file', 'rancho_file',
            'operadores_id', 'operarios_id', 'contables_id',
        ]
        extra_kwargs = {
            'cliente': {'required': False},
            'ship': {'required': False},
            'port': {'required': False},
            'agency': {'required': False},
            'eta': {'required': False},
            'order_received_date': {'required': False, 'allow_null': True},
            'client_confirmed_date': {'required': False, 'allow_null': True},
            'delivery_date': {'required': False, 'allow_null': True},
            'closed_date': {'required': False, 'allow_null': True},
        }

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['products'] = self.get_products(instance)
        return ret

    def get_products(self, obj):
        detalles = OperacionDetalle.objects.filter(operacion=obj)
        productos = []
        for detalle in detalles:
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
                productos.append({
                    "product": detalle.articulo_id,
                    "product_name": f"Artículo {detalle.articulo_id} (no encontrado)",
                    "quantity": detalle.cantidad,
                    "unit_price": float(detalle.precio_unitario) if detalle.precio_unitario else 0,
                    "weight_kg": None,
                    "presentation": "",
                })
        return productos

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

    def _resolve_nested(self, data_dict, field, model_class, defaults):
        val = data_dict.get(field)
        if val and isinstance(val, str) and not str(val).isdigit():
            obj, _ = model_class.objects.get_or_create(name=val, defaults=defaults)
            return obj.id
        return val

    def to_internal_value(self, data):
        import random
        mutable_data = data.copy() if hasattr(data, 'copy') else data

        if 'client' in mutable_data:
            mutable_data['cliente'] = self._resolve_nested(mutable_data, 'client', Client, {'email': 'default@email.com'})
        if 'ship' in mutable_data:
            val = mutable_data.get('ship')
            if val and isinstance(val, str) and not str(val).isdigit():
                obj, _ = Ship.objects.get_or_create(name=val, defaults={'imo': f'TBD{random.randint(1000,9999)}', 'flag': 'TBD'})
                mutable_data['ship'] = obj.id
        if 'port' in mutable_data:
            mutable_data['port'] = self._resolve_nested(mutable_data, 'port', Port, {'country': 'TBD'})
        if 'agency' in mutable_data:
            val = mutable_data.get('agency')
            if val and isinstance(val, str) and not str(val).isdigit():
                obj, _ = Agency.objects.get_or_create(name=val, defaults={'email': 'default@email.com', 'contact_name': 'TBD', 'phone': '0'})
                mutable_data['agency'] = obj.id
                
        if 'notes' in mutable_data:
            mutable_data['notas'] = mutable_data.pop('notes')
        if 'eta' in mutable_data and not mutable_data['eta']:
            mutable_data['eta'] = None

        return super().to_internal_value(mutable_data)

    def create(self, validated_data):
        products_data = validated_data.pop('products', None)
        if products_data is None:
            products_data = self.initial_data.get('products', [])
            
        if isinstance(products_data, str):
            try:
                products_data = json.loads(products_data)
            except ValueError:
                products_data = []

        operation = super().create(validated_data)
        self._handle_products(operation, products_data)
        return operation

    def update(self, instance, validated_data):
        products_data = validated_data.pop('products', None)
        if products_data is None:
            products_data = self.initial_data.get('products', [])

        if isinstance(products_data, str):
            try:
                products_data = json.loads(products_data)
            except ValueError:
                products_data = []

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
                    nombre=p_val, defaults={'presentacion': 'Unidad', 'peso_kg': 1.0}
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
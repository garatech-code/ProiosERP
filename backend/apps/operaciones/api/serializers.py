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


class OperacionDetalleSerializer(serializers.ModelSerializer):
    articulo_nombre = serializers.SerializerMethodField()
    articulo_presentacion = serializers.SerializerMethodField()
    stock_disponible = serializers.SerializerMethodField()
    suficiente = serializers.SerializerMethodField()

    class Meta:
        model = OperacionDetalle
        fields = ['id', 'operacion', 'articulo_id', 'cantidad', 'precio_unitario',
                  'articulo_nombre', 'articulo_presentacion', 'stock_disponible', 'suficiente']
        read_only_fields = ['id', 'operacion']

    def get_articulo(self, obj):
        try:
            return Articulo.objects.get(id=obj.articulo_id)
        except Articulo.DoesNotExist:
            return None

    def get_articulo_nombre(self, obj):
        articulo = self.get_articulo(obj)
        return articulo.nombre if articulo else f"ID {obj.articulo_id} (no existe)"

    def get_articulo_presentacion(self, obj):
        articulo = self.get_articulo(obj)
        return articulo.presentacion if articulo else ""

    def get_stock_disponible(self, obj):
        articulo = self.get_articulo(obj)
        return float(articulo.stock_actual) if articulo else 0

    def get_suficiente(self, obj):
        articulo = self.get_articulo(obj)
        if not articulo:
            return False
        return articulo.stock_actual >= obj.cantidad


class OperacionSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='cliente.name', read_only=True)
    ship_name = serializers.CharField(source='ship.name', read_only=True)
    ship_flag = serializers.CharField(source='ship.flag', read_only=True)
    port_name = serializers.CharField(source='port.name', read_only=True)
    agency_name = serializers.CharField(source='agency.name', read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    products = serializers.JSONField(required=False)

    can_confirm = serializers.SerializerMethodField()
    can_send_to_customs = serializers.SerializerMethodField()
    can_coordinate = serializers.SerializerMethodField()
    can_deliver = serializers.SerializerMethodField()

    detalles = OperacionDetalleSerializer(many=True, read_only=True)

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
            'id', 'client_name', 'ship_name', 'ship_flag', 'port_name', 'agency_name', 'eta',
            'delivery_method', 'status', 'products', 'detalles',
            'cliente', 'ship', 'port', 'agency', 'notas',
            'order_received_date', 'client_confirmed_date',
            'delivery_date', 'closed_date',
            'packing_list_file', 'remito_file', 'rancho_file',
            'operadores_id', 'operarios_id', 'contables_id',
            'can_confirm', 'can_send_to_customs', 'can_coordinate', 'can_deliver',
            'stock_consumido', 'tipo_operacion', 'aprobacion_requerida_owner',
            'detalle_servicio', 'forma_cotizacion_servicio',
            'estado_revision', 'mensaje_revision', 'texto_pedido'
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
        read_only_fields = ['estado_revision', 'mensaje_revision']

    def get_can_confirm(self, obj):
        return obj.estado == Operacion.ESTADO_SOLICITADA

    def get_can_send_to_customs(self, obj):
        return obj.estado == Operacion.ESTADO_ARMADO_PACKING

    def get_can_coordinate(self, obj):
        return obj.estado == Operacion.ESTADO_EN_ADUANA

    def get_can_deliver(self, obj):
        return obj.estado == Operacion.ESTADO_LISTA_PARA_ENVIO

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['products'] = self.get_products(instance)
        return ret

    def get_products(self, obj):
        # Usar detalles precargados (prefetch_related en view)
        detalles = obj.detalles.all()
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
                    "stock_actual": float(articulo.stock_actual),
                    "suficiente": articulo.stock_actual >= detalle.cantidad
                })
            except Articulo.DoesNotExist:
                productos.append({
                    "product": detalle.articulo_id,
                    "product_name": f"Artículo {detalle.articulo_id} (no encontrado)",
                    "quantity": detalle.cantidad,
                    "unit_price": float(detalle.precio_unitario) if detalle.precio_unitario else 0,
                    "weight_kg": None,
                    "presentation": "",
                    "stock_actual": 0,
                    "suficiente": False
                })
        return productos

    def get_status(self, obj):
        mapper = {
            Operacion.ESTADO_SOLICITADA: 'solicitada',
            Operacion.ESTADO_ARMADO_PACKING: 'armado_packing',
            Operacion.ESTADO_EN_ADUANA: 'en_aduana',
            Operacion.ESTADO_LISTA_PARA_ENVIO: 'lista_para_envio',
            Operacion.ESTADO_REMITADA: 'remitada',
            Operacion.ESTADO_ENTREGADA: 'entregada',
            Operacion.ESTADO_CANCELADA: 'cancelada'
        }
        return mapper.get(obj.estado, obj.estado)

    def _resolve_nested(self, data_dict, field, model_class, defaults):
        """Resuelve campos anidados (solo para Client, Port, Agency) pero NO para Ship"""
        val = data_dict.get(field)
        if val and isinstance(val, str) and not str(val).isdigit():
            obj, _ = model_class.objects.get_or_create(name=val, defaults=defaults)
            return obj.id
        return val

    def to_internal_value(self, data):
        import random
        mutable_data = data.copy() if hasattr(data, 'copy') else data

        # Cliente, puerto y agencia pueden crearse automáticamente (solo por nombre)
        if 'client' in mutable_data:
            mutable_data['cliente'] = self._resolve_nested(mutable_data, 'client', Client, {'email': 'default@email.com'})
        if 'port' in mutable_data:
            mutable_data['port'] = self._resolve_nested(mutable_data, 'port', Port, {'country': 'TBD'})
        if 'agency' in mutable_data:
            val = mutable_data.get('agency')
            if val and isinstance(val, str) and not str(val).isdigit():
                obj, _ = Agency.objects.get_or_create(name=val, defaults={'email': 'default@email.com', 'contact_name': 'TBD', 'phone': '0'})
                mutable_data['agency'] = obj.id

        # Ship NO se crea automáticamente: solo acepta ID numérico existente
        ship_val = mutable_data.get('ship')
        if ship_val and isinstance(ship_val, str) and not ship_val.isdigit():
            raise serializers.ValidationError({'ship': 'El buque debe ser un ID numérico existente. No se permite creación automática.'})

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
        """
        Maneja productos de la operación.
        IMPORTANTE: No crea artículos automáticamente. Solo acepta IDs numéricos existentes.
        """
        for prod in products:
            p_val = prod.get('product')
            if not p_val:
                continue

            # Solo aceptar IDs numéricos
            if isinstance(p_val, str) and not p_val.isdigit():
                raise serializers.ValidationError(
                    f"El producto '{p_val}' no es válido. Debe proporcionar un ID numérico de un artículo existente."
                )
            articulo_id = int(p_val)

            # Verificar que el artículo exista
            if not Articulo.objects.filter(id=articulo_id).exists():
                raise serializers.ValidationError(
                    f"Artículo con ID {articulo_id} no existe en el inventario."
                )

            cantidad = prod.get('quantity', 0)
            if cantidad <= 0:
                raise serializers.ValidationError(
                    f"La cantidad del producto ID {articulo_id} debe ser mayor a cero."
                )

            OperacionDetalle.objects.create(
                operacion=operation,
                articulo_id=articulo_id,
                cantidad=cantidad,
                precio_unitario=prod.get('unit_price', 0)
            )
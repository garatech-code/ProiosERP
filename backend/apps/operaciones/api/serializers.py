from rest_framework import serializers
from apps.operaciones.models import Operacion, OperacionDetalle, Client, Ship, Port, Agency, AgendaEvent, DocumentoAdjunto
from apps.inventario.models import Articulo
from apps.usuarios.models import User, PersonalPlantel
import json


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'email', 'contact_person', 'phone']


class ShipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ship
        fields = ['id', 'name', 'imo', 'flag', 'call_sign', 'gross_tonnage']
        # Permitimos nulos y vacíos para compatibilidad con datos existentes
        extra_kwargs = {
            'imo': {'required': False, 'allow_null': True, 'allow_blank': True},
            'flag': {'required': False, 'allow_null': True, 'allow_blank': True},
        }


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


class DocumentoAdjuntoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoAdjunto
        fields = ['id', 'tipo', 'nombre_personalizado', 'archivo', 'descripcion', 'fecha_subida', 'subido_por']
        read_only_fields = ['id', 'fecha_subida', 'subido_por']


class OperacionSerializer(serializers.ModelSerializer):
    # Campos de solo lectura (relaciones)
    client_name = serializers.CharField(source='cliente.name', read_only=True)
    client_email = serializers.CharField(source='cliente.email', read_only=True)
    ship_name = serializers.CharField(source='ship.name', read_only=True)
    ship_flag = serializers.CharField(source='ship.flag', read_only=True)
    port_name = serializers.CharField(source='port.name', read_only=True)
    agency_name = serializers.CharField(source='agency.name', read_only=True)
    agency_email = serializers.CharField(source='agency.email', read_only=True)

    # Nombres de operarios
    operarios_nombres = serializers.SerializerMethodField()
    operarios_usuarios_nombres = serializers.SerializerMethodField()

    # Productos como JSON (input/output)
    products = serializers.JSONField(required=False)

    # Transiciones y estados calculados
    status = serializers.SerializerMethodField()
    can_confirm = serializers.SerializerMethodField()
    can_send_to_customs = serializers.SerializerMethodField()
    can_coordinate = serializers.SerializerMethodField()
    can_deliver = serializers.SerializerMethodField()

    # Relaciones anidadas (solo lectura)
    detalles = OperacionDetalleSerializer(many=True, read_only=True)
    documentos_adjuntos = DocumentoAdjuntoSerializer(many=True, read_only=True)

    # Relaciones ManyToMany (escritura)
    operadores_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='operadores_asignados', required=False
    )
    # Operarios de plantel (PersonalPlantel) - campo ManyToMany real
    operarios_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PersonalPlantel.objects.all(),
        source='operarios_asignados', required=False
    )
    contables_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='contables_asignados', required=False
    )
    operarios_usuarios_id = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        source='operarios_usuarios_asignados', required=False
    )

    # Snapshot de operarios (solo lectura, para compatibilidad con versiones anteriores)
    plantel_asignado = serializers.JSONField(read_only=True)

    class Meta:
        model = Operacion
        fields = [
            'id', 'client_name', 'client_email', 'ship_name', 'ship_flag', 'port_name', 'agency_name', 'agency_email', 'eta',
            'delivery_method', 'status', 'estado', 'products', 'detalles', 'documentos_adjuntos',
            'cliente', 'ship', 'port', 'agency', 'notas',
            'order_received_date', 'client_confirmed_date', 'quotation_sent_date', 'quoted_by', 'dificil_conseguir',
            'delivery_date', 'closed_date', 'closed_by', 'motivo_rechazo',
            'packing_list_file', 'remito_file', 'rancho_file', 'solicitud_particular_file',
            'operadores_id', 'operarios_id', 'contables_id', 'operarios_usuarios_id',
            'operarios_nombres', 'operarios_usuarios_nombres', 'plantel_asignado',
            'can_confirm', 'can_send_to_customs', 'can_coordinate', 'can_deliver',
            'stock_consumido', 'tipo_operacion', 'aprobacion_requerida_owner',
            'detalle_servicio', 'subtipo_servicio', 'forma_cotizacion_servicio', 'valor_servicio',
            'estado_revision', 'mensaje_revision', 'texto_pedido', 'nombre',
            'herramientas_solicitud_particular', 'texto_permiso_pna', 'texto_cotizacion_adicional',
            'creado_por'
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
        read_only_fields = ['estado_revision', 'mensaje_revision', 'creado_por']

    # Métodos auxiliares
    def get_operarios_nombres(self, obj):
        return [f"{s.apellidos}, {s.nombres}" for s in obj.operarios_asignados.all()]

    def get_operarios_usuarios_nombres(self, obj):
        return [
            f"{u.first_name} {u.last_name}".strip() if u.first_name or u.last_name else u.username
            for u in obj.operarios_usuarios_asignados.all()
        ]

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
        detalles = obj.detalles.all()
        productos = []
        for detalle in detalles:
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                suficiente = True if not articulo.controlar_stock else (articulo.stock_actual >= detalle.cantidad)
                productos.append({
                    "product": detalle.articulo_id,
                    "product_name": articulo.nombre,
                    "quantity": detalle.cantidad,
                    "unit_price": float(detalle.precio_unitario) if detalle.precio_unitario else 0,
                    "weight_kg": float(articulo.peso_kg) if articulo.peso_kg else None,
                    "presentation": articulo.presentacion,
                    "stock_actual": float(articulo.stock_actual),
                    "suficiente": suficiente,
                    "controlar_stock": articulo.controlar_stock
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
                    "suficiente": False,
                    "controlar_stock": True
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
        """Resuelve campos anidados (solo para Client, Port, Agency) por nombre"""
        val = data_dict.get(field)
        if val and isinstance(val, str) and not str(val).isdigit():
            obj, _ = model_class.objects.get_or_create(name=val, defaults=defaults)
            return obj.id
        return val

    def to_internal_value(self, data):
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

        # Crear la operación
        operation = super().create(validated_data)

        # Manejar productos
        self._handle_products(operation, products_data)

        # Actualizar snapshot de operarios (a partir de la relación ManyToMany)
        self._update_plantel_snapshot(operation)

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

        # Manejar productos
        if products_data is not None:
            operation.detalles.all().delete()
            self._handle_products(operation, products_data)

        # Actualizar snapshot de operarios
        self._update_plantel_snapshot(operation)

        return operation

    def _handle_products(self, operation, products):
        """Crea los detalles de productos para la operación"""
        for prod in products:
            p_val = prod.get('product')
            if not p_val:
                continue

            if isinstance(p_val, str) and not p_val.isdigit():
                raise serializers.ValidationError(
                    f"El producto '{p_val}' no es válido. Debe proporcionar un ID numérico de un artículo existente."
                )
            articulo_id = int(p_val)

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

    def _update_plantel_snapshot(self, operation):
        """Actualiza el campo JSON plantel_asignado basado en la relación ManyToMany operarios_asignados"""
        operarios = operation.operarios_asignados.all()
        datos = [
            {
                'id': op.id,
                'nombres': op.nombres,
                'apellidos': op.apellidos,
                'dni': op.dni,
                'rol': op.rol
            }
            for op in operarios
        ]
        operation.plantel_asignado = datos
        operation.save(update_fields=['plantel_asignado'])


class AgendaEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = AgendaEvent
        fields = [
            'id', 'title', 'description', 'start_date', 'end_date',
            'created_by', 'created_by_name', 'assigned_to', 'assigned_to_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return ""
        return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
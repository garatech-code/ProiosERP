from rest_framework import serializers
from .models import Resource, Event, Client, Ship, Port, Product, Agency, Operation, OperationProduct

class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = '__all__'
        read_only_fields = ['owner']

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'

class ShipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ship
        fields = '__all__'

class PortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Port
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = '__all__'

class OperationProductSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())

    class Meta:
        model = OperationProduct
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price']

class OperationSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    ship_name = serializers.ReadOnlyField(source='ship.name')
    port_name = serializers.ReadOnlyField(source='port.name')
    agency_name = serializers.ReadOnlyField(source='agency.name')
    products = OperationProductSerializer(many=True, required=False)

    can_confirm = serializers.SerializerMethodField()
    can_coordinate = serializers.SerializerMethodField()
    can_deliver = serializers.SerializerMethodField()
    can_close = serializers.SerializerMethodField()

    def get_can_confirm(self, obj):
        return obj.status == 'price_checked'

    def get_can_coordinate(self, obj):
        return obj.status == 'confirmed'

    def get_can_deliver(self, obj):
        return obj.status == 'in_coordination' and bool(obj.remito_file)

    def get_can_close(self, obj):
        return obj.status == 'delivered' and bool(obj.remito_file)

    class Meta:
        model = Operation
        fields = [
            'id', 'client', 'client_name', 'ship', 'ship_name', 'port', 'port_name',
            'agency', 'agency_name', 'eta', 'status', 'delivery_method', 'notes',
            'packing_list_file', 'remito_file', 'rancho_file',
            'order_received_date', 'client_confirmed_date', 'delivery_date', 'closed_date',
            'created_by', 'updated_at', 'products',
            'can_confirm', 'can_coordinate', 'can_deliver', 'can_close'
        ]
        read_only_fields = ['order_received_date', 'updated_at', 'created_by']

    def to_internal_value(self, data):
        # Auto-create related objects if frontend sends a string instead of an ID
        mutable_data = data.copy() if hasattr(data, 'copy') else data

        def _get_or_create_from_string(field, model, defaults):
            val = mutable_data.get(field)
            if val and isinstance(val, str) and not val.isdigit():
                obj, _ = model.objects.get_or_create(name=val, defaults=defaults)
                mutable_data[field] = obj.id

        import random
        _get_or_create_from_string('client', Client, {'email': 'default@email.com'})
        _get_or_create_from_string('ship', Ship, {'imo': f'TBD{random.randint(1000, 9999)}', 'flag': 'TBD'})
        _get_or_create_from_string('port', Port, {'country': 'TBD'})
        _get_or_create_from_string('agency', Agency, {'email': 'default@email.com', 'phone': '0', 'contact_name': 'TBD'})

        # Intercept products to allow string names
        products_data = mutable_data.get('products')
        if products_data and isinstance(products_data, list):
            for i, p_data in enumerate(products_data):
                p_val = p_data.get('product')
                if p_val and isinstance(p_val, str) and not str(p_val).isdigit():
                    prod, _ = Product.objects.get_or_create(
                        name=p_val, 
                        defaults={'presentation': 'Unidad', 'weight_kg': 1.0}
                    )
                    # We have to mutate the list item
                    if hasattr(products_data[i], 'copy'):
                        products_data[i] = products_data[i].copy()
                    products_data[i]['product'] = prod.id

        return super().to_internal_value(mutable_data)

    def create(self, validated_data):
        products_data = validated_data.pop('products', [])
        operation = Operation.objects.create(**validated_data)
        for prod_data in products_data:
            OperationProduct.objects.create(operation=operation, **prod_data)
        return operation

    def update(self, instance, validated_data):
        products_data = validated_data.pop('products', None)
        instance = super().update(instance, validated_data)
        if products_data is not None:
            instance.products.all().delete()
            for prod_data in products_data:
                OperationProduct.objects.create(operation=instance, **prod_data)
        return instance
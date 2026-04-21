from rest_framework import serializers
from apps.inventario.models import Articulo, MovimientoStock, Proveedor

class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = ['id', 'nombre', 'contacto', 'telefono', 'email', 'direccion', 'rubro', 'condicion_pago']
        read_only_fields = ['id']

class ArticuloSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source='proveedor.nombre', read_only=True)
    
    class Meta:
        model = Articulo
        fields = ['id', 'nombre', 'descripcion', 'presentacion', 'peso_kg', 'stock_actual', 
                  'stock_minimo', 'categoria', 'proveedor', 'proveedor_nombre']
        read_only_fields = ['id']

class MovimientoStockSerializer(serializers.ModelSerializer):
    articulo_nombre = serializers.CharField(source='articulo.nombre', read_only=True)
    
    class Meta:
        model = MovimientoStock
        fields = ['id', 'articulo', 'articulo_nombre', 'tipo', 'cantidad', 'stock_resultante', 
                  'operacion_id', 'razon', 'fecha']
        read_only_fields = ['stock_resultante', 'fecha']

class DisponibilidadSerializer(serializers.Serializer):
    """Serializer para solicitud de disponibilidad de múltiples productos"""
    productos = serializers.ListField(
        child=serializers.DictField(),
        write_only=True
    )
    
    def validate_productos(self, value):
        for item in value:
            if 'articulo_id' not in item or 'cantidad' not in item:
                raise serializers.ValidationError("Cada producto debe tener 'articulo_id' y 'cantidad'")
        return value
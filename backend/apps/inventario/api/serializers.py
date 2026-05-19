from rest_framework import serializers
from apps.inventario.models import Articulo, MovimientoStock, Proveedor, ProductoLog


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
                  'stock_minimo', 'stock_maximo', 'categoria', 'proveedor', 'proveedor_nombre']
        read_only_fields = ['id']


class MovimientoStockSerializer(serializers.ModelSerializer):
    articulo_nombre = serializers.CharField(source='articulo.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True, default='Sistema')

    class Meta:
        model = MovimientoStock
        fields = ['id', 'articulo', 'articulo_nombre', 'tipo', 'cantidad', 'stock_resultante',
                  'operacion_id', 'razon', 'fecha', 'usuario', 'usuario_nombre']
        read_only_fields = ['stock_resultante', 'fecha', 'usuario']


class ProductoLogSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True, default='Eliminado')

    class Meta:
        model = ProductoLog
        fields = ['id', 'producto', 'producto_nombre', 'accion', 'campos_modificados',
                  'usuario', 'usuario_nombre', 'fecha', 'ip']


class DisponibilidadSerializer(serializers.Serializer):
    productos = serializers.ListField(
        child=serializers.DictField(),
        write_only=True
    )
    
    def validate_productos(self, value):
        for item in value:
            if 'articulo_id' not in item or 'cantidad' not in item:
                raise serializers.ValidationError("Cada producto debe tener 'articulo_id' y 'cantidad'")
        return value
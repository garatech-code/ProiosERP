from rest_framework import serializers
from apps.inventario.models import Articulo

class ProductSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='nombre', required=True)
    presentation = serializers.CharField(source='presentacion', required=False, allow_blank=True)
    weight_kg = serializers.DecimalField(source='peso_kg', max_digits=10, decimal_places=2, required=False)

    class Meta:
        model = Articulo
        fields = ['id', 'name', 'presentation', 'weight_kg']
from rest_framework import serializers
from apps.produccion.models import FormulaBOM, ComponenteBOM
from apps.inventario.models import Articulo

class ComponenteBOMSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.SerializerMethodField()
    insumo_presentacion = serializers.SerializerMethodField()

    class Meta:
        model = ComponenteBOM
        fields = ['id', 'insumo_id', 'insumo_nombre', 'insumo_presentacion', 'cantidad_requerida']

    def get_insumo_nombre(self, obj):
        try:
            return Articulo.objects.get(id=obj.insumo_id).nombre
        except Articulo.DoesNotExist:
            return "Insumo Eliminado"

    def get_insumo_presentacion(self, obj):
        try:
            return Articulo.objects.get(id=obj.insumo_id).presentacion
        except Articulo.DoesNotExist:
            return ""

class FormulaBOMSerializer(serializers.ModelSerializer):
    componentes = ComponenteBOMSerializer(many=True, required=False)
    articulo_final_nombre = serializers.SerializerMethodField()

    class Meta:
        model = FormulaBOM
        fields = ['id', 'nombre', 'articulo_final_id', 'articulo_final_nombre', 'activa', 'componentes']

    def get_articulo_final_nombre(self, obj):
        try:
            return Articulo.objects.get(id=obj.articulo_final_id).nombre
        except Articulo.DoesNotExist:
            return "Artículo Eliminado"

    def create(self, validated_data):
        componentes_data = validated_data.pop('componentes', [])
        formula = FormulaBOM.objects.create(**validated_data)
        for comp_data in componentes_data:
            ComponenteBOM.objects.create(formula=formula, **comp_data)
        return formula

    def update(self, instance, validated_data):
        componentes_data = validated_data.pop('componentes', None)
        instance.nombre = validated_data.get('nombre', instance.nombre)
        instance.articulo_final_id = validated_data.get('articulo_final_id', instance.articulo_final_id)
        instance.activa = validated_data.get('activa', instance.activa)
        instance.save()

        if componentes_data is not None:
            # Eliminar existentes y volver a crearlos
            instance.componentes.all().delete()
            for comp_data in componentes_data:
                ComponenteBOM.objects.create(formula=instance, **comp_data)
                
        return instance

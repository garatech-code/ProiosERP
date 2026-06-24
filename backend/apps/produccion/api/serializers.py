from rest_framework import serializers
from apps.produccion.models import FormulaBOM, ComponenteBOM, OrdenFabricacion
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

    def validate(self, data):
        articulo_final_id = data.get('articulo_final_id')
        if articulo_final_id:
            try:
                art_final = Articulo.objects.get(id=articulo_final_id)
                if art_final.categoria != 'quimicos':
                    raise serializers.ValidationError(
                        {"articulo_final_id": "El artículo final debe tener la categoría 'quimicos'."}
                    )
            except Articulo.DoesNotExist:
                raise serializers.ValidationError(
                    {"articulo_final_id": "El artículo final no existe en el inventario."}
                )

        componentes = data.get('componentes', [])
        if componentes:
            from decimal import Decimal
            total_qty = sum(Decimal(str(comp.get('cantidad_requerida', 0))) for comp in componentes)
            if abs(total_qty - Decimal('1.0')) > Decimal('0.0001'):
                raise serializers.ValidationError(
                    {"componentes": "La suma de los porcentajes de los ingredientes debe ser exactamente 100%."}
                )
        for comp in componentes:
            insumo_id = comp.get('insumo_id')
            if insumo_id:
                try:
                    insumo = Articulo.objects.get(id=insumo_id)
                    if insumo.categoria != 'quimicos':
                        raise serializers.ValidationError(
                            {"componentes": f"El ingrediente '{insumo.nombre}' debe tener la categoría 'quimicos'."}
                        )
                except Articulo.DoesNotExist:
                    raise serializers.ValidationError(
                        {"componentes": f"El ingrediente con ID {insumo_id} no existe en el inventario."}
                    )
        return data

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

class OrdenFabricacionSerializer(serializers.ModelSerializer):
    formula_nombre = serializers.SerializerMethodField()
    articulo_final_nombre = serializers.SerializerMethodField()
    operacion_nombre = serializers.SerializerMethodField()

    class Meta:
        model = OrdenFabricacion
        fields = [
            'id', 'operacion_id', 'formula', 'formula_nombre', 
            'articulo_final_nombre', 'operacion_nombre', 
            'cantidad_a_producir', 'completada', 'fecha_solicitud'
        ]

    def get_formula_nombre(self, obj):
        return obj.formula.nombre

    def get_articulo_final_nombre(self, obj):
        try:
            return Articulo.objects.get(id=obj.formula.articulo_final_id).nombre
        except Articulo.DoesNotExist:
            return "Artículo Eliminado"

    def get_operacion_nombre(self, obj):
        from apps.operaciones.models import Operacion
        try:
            op = Operacion.objects.get(id=obj.operacion_id)
            return str(op)
        except Operacion.DoesNotExist:
            return f"OP-{obj.operacion_id:05d}"


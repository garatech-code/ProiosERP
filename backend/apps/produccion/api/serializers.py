from rest_framework import serializers
from apps.produccion.models import FormulaBOM, ComponenteBOM, OrdenFabricacion
from apps.inventario.models import Articulo

class ComponenteBOMSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.SerializerMethodField()
    insumo_presentacion = serializers.SerializerMethodField()
    insumo_costo = serializers.SerializerMethodField()
    insumo_categoria = serializers.SerializerMethodField()

    class Meta:
        model = ComponenteBOM
        fields = ['id', 'insumo_id', 'insumo_nombre', 'insumo_presentacion', 'insumo_costo', 'insumo_categoria', 'cantidad_requerida']

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

    def get_insumo_costo(self, obj):
        try:
            return float(Articulo.objects.get(id=obj.insumo_id).costo)
        except Articulo.DoesNotExist:
            return 0.0

    def get_insumo_categoria(self, obj):
        try:
            return Articulo.objects.get(id=obj.insumo_id).categoria
        except Articulo.DoesNotExist:
            return ""

class FormulaBOMSerializer(serializers.ModelSerializer):
    componentes = ComponenteBOMSerializer(many=True, required=False)
    articulo_final_nombre = serializers.SerializerMethodField()

    costo_preparacion = serializers.SerializerMethodField()
    precio_venta = serializers.SerializerMethodField()
    ganancia = serializers.SerializerMethodField()
    ganancia_porcentaje = serializers.SerializerMethodField()

    class Meta:
        model = FormulaBOM
        fields = ['id', 'nombre', 'articulo_final_id', 'articulo_final_nombre', 'activa', 'componentes', 'costo_preparacion', 'precio_venta', 'ganancia', 'ganancia_porcentaje']

    def get_articulo_final_nombre(self, obj):
        try:
            return Articulo.objects.get(id=obj.articulo_final_id).nombre
        except Articulo.DoesNotExist:
            return "Artículo Eliminado"

    def get_costo_preparacion(self, obj):
        from decimal import Decimal
        total = Decimal('0.0')
        for comp in obj.componentes.all():
            try:
                insumo = Articulo.objects.get(id=comp.insumo_id)
                total += Decimal(str(insumo.costo)) * Decimal(str(comp.cantidad_requerida))
            except Articulo.DoesNotExist:
                pass
        return float(total)

    def get_precio_venta(self, obj):
        try:
            art = Articulo.objects.get(id=obj.articulo_final_id)
            return float(art.precio_venta)
        except Articulo.DoesNotExist:
            return 0.0

    def get_ganancia(self, obj):
        costo = self.get_costo_preparacion(obj)
        precio = self.get_precio_venta(obj)
        return float(precio) - costo

    def get_ganancia_porcentaje(self, obj):
        costo = self.get_costo_preparacion(obj)
        ganancia = self.get_ganancia(obj)
        if costo > 0:
            return (ganancia / costo) * 100
        return 0.0

    def validate(self, data):
        articulo_final_id = data.get('articulo_final_id')
        if articulo_final_id:
            try:
                art_final = Articulo.objects.get(id=articulo_final_id)
                if art_final.categoria.lower() not in ['quimicos', 'químicos']:
                    raise serializers.ValidationError(
                        {"articulo_final_id": "El artículo final debe tener la categoría 'Químicos'."}
                    )
            except Articulo.DoesNotExist:
                raise serializers.ValidationError(
                    {"articulo_final_id": "El artículo final no existe en el inventario."}
                )

        componentes = data.get('componentes', [])
        for comp in componentes:
            insumo_id = comp.get('insumo_id')
            if insumo_id:
                try:
                    insumo = Articulo.objects.get(id=insumo_id)
                    if insumo.categoria.lower() not in ['quimicos', 'químicos', 'empaque']:
                        raise serializers.ValidationError(
                            {"componentes": f"El ingrediente '{insumo.nombre}' debe tener la categoría 'Químicos' o 'Empaque'."}
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
            
        self._update_articulo_costo(formula)
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
                
        self._update_articulo_costo(instance)
        return instance

    def _update_articulo_costo(self, formula):
        try:
            art = Articulo.objects.get(id=formula.articulo_final_id)
            art.costo = round(self.get_costo_preparacion(formula), 2)
            art.save()
        except Articulo.DoesNotExist:
            pass

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


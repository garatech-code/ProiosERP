from django.db import models

class FormulaBOM(models.Model):
    nombre = models.CharField(max_length=150)
    articulo_final_id = models.IntegerField()  # Lax FK a inventario.Articulo
    activa = models.BooleanField(default=True)

class ComponenteBOM(models.Model):
    formula = models.ForeignKey(FormulaBOM, on_delete=models.CASCADE, related_name='componentes')
    insumo_id = models.IntegerField() # Lax FK a inventario.Articulo
    cantidad_requerida = models.DecimalField(max_digits=15, decimal_places=4)

class OrdenFabricacion(models.Model):
    operacion_id = models.IntegerField() # Lax FK a operaciones.Operacion
    formula = models.ForeignKey(FormulaBOM, on_delete=models.RESTRICT)
    cantidad_a_producir = models.DecimalField(max_digits=15, decimal_places=2)
    completada = models.BooleanField(default=False)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)

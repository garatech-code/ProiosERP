from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Proveedor(models.Model):
    CONDICION_PAGO_CHOICES = (
        ('contado', 'Contado'),
        ('30_dias', '30 Días'),
        ('60_dias', '60 Días'),
        ('90_dias', '90 Días'),
        ('otros', 'Otros'),
    )
    
    nombre = models.CharField(max_length=200, unique=True)
    contacto = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    rubro = models.CharField(max_length=100, blank=True)
    condicion_pago = models.CharField(max_length=20, choices=CONDICION_PAGO_CHOICES, default='contado')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nombre


class Articulo(models.Model):
    CATEGORIA_CHOICES = (
        ('quimicos', 'Químicos'),
        ('otros', 'Otros'),
        ('insumos', 'Insumos'),
    )
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    presentacion = models.CharField(max_length=100)
    peso_kg = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=15, decimal_places=4, default=0.0)
    stock_minimo = models.DecimalField(max_digits=15, decimal_places=4, default=0.0, help_text="Stock mínimo para alerta (amarillo)")
    stock_maximo = models.DecimalField(max_digits=15, decimal_places=4, default=0.0, help_text="Stock máximo (opcional)")
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='otros')
    controlar_stock = models.BooleanField(
        default=True,
        help_text="Si se desmarca, el artículo no requerirá stock en inventario y no bloqueará confirmaciones."
    )
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True, related_name='articulos')
    ultima_modificacion = models.DateTimeField(auto_now=True)
    modificado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.nombre} ({self.presentacion})"


class MovimientoStock(models.Model):
    TIPO_CHOICES = (
        ('INGRESO', 'Ingreso'),
        ('SALIDA', 'Salida'),
        ('AJUSTE', 'Ajuste'),
    )

    articulo = models.ForeignKey(Articulo, on_delete=models.CASCADE, related_name='movimientos')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=15, decimal_places=4)
    stock_resultante = models.DecimalField(max_digits=15, decimal_places=4)
    operacion_id = models.IntegerField(null=True, blank=True)
    razon = models.CharField(max_length=255)
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='movimientos_stock')

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.cantidad} {self.articulo.nombre}"


class ProductoLog(models.Model):
    ACCION_CHOICES = (
        ('CREATE', 'Creación'),
        ('UPDATE', 'Actualización'),
        ('DELETE', 'Eliminación'),
    )
    producto = models.ForeignKey(Articulo, on_delete=models.CASCADE, related_name='logs', null=True, blank=True)
    accion = models.CharField(max_length=10, choices=ACCION_CHOICES)
    campos_modificados = models.JSONField(default=dict, blank=True, help_text="Diccionario de campos y valores antiguos/nuevos")
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-fecha']
        verbose_name = "Log de Producto"
        verbose_name_plural = "Logs de Productos"

    def __str__(self):
        return f"{self.get_accion_display()} - {self.producto.nombre if self.producto else 'Eliminado'} - {self.fecha}"
from django.db import models

class Proveedor(models.Model):
    CONDICION_PAGO_CHOICES = (
        ('contado', 'Contado'),
        ('30_dias', '30 Días'),
        ('60_dias', '60 Días'),
        ('90_dias', '90 Días'),
        ('otros', 'Otros'),
    )
    
    nombre = models.CharField(max_length=200, unique=True)  # Razón social
    contacto = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    rubro = models.CharField(max_length=100, blank=True)   # Texto libre
    condicion_pago = models.CharField(max_length=20, choices=CONDICION_PAGO_CHOICES, default='contado')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nombre

class Articulo(models.Model):
    CATEGORIA_CHOICES = (
        ('quimicos', 'Químicos'),
        ('otros', 'Otros'),
    )
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    presentacion = models.CharField(max_length=100)
    peso_kg = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=15, decimal_places=4, default=0.0)
    stock_minimo = models.DecimalField(max_digits=15, decimal_places=4, default=0.0, help_text="Stock mínimo para alerta (amarillo)")
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='otros')
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True, related_name='articulos')

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
    operacion_id = models.IntegerField(null=True, blank=True) # Lax FK to Operaciones
    razon = models.CharField(max_length=255)
    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.cantidad} {self.articulo.nombre}"
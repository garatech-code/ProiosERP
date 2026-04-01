from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
import uuid
from django.utils import timezone

class OutboxEvent(models.fields.UUIDField):
    # Using simple Model for outbox
    pass

class Event(models.Model):
    """
    Transactional Outbox Pattern.
    Eventos que se guardan en la misma transacción que el objeto de negocio.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pendiente'),
        ('PROCESSING', 'Procesando'),
        ('PROCESSED', 'Procesado'),
        ('FAILED', 'Fallido'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Event {self.type} - {self.status}"

class Resource(models.Model):
    """
    Recurso de ejemplo para demostrar concurrencia, lock y F expressions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='resources')
    stock = models.IntegerField(default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name



User = get_user_model()

class Client(models.Model):
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    price_list = models.JSONField(default=dict, blank=True)  # {producto_id: precio_por_unidad}
    # Podríamos tener un modelo PriceList aparte, pero para simplificar usamos JSON.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Ship(models.Model):
    name = models.CharField(max_length=200)
    imo = models.CharField(max_length=7, unique=True)  # Número IMO de 7 dígitos
    flag = models.CharField(max_length=50)  # Bandera
    # Otros datos opcionales
    call_sign = models.CharField(max_length=20, blank=True)
    gross_tonnage = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} (IMO: {self.imo})"

class Port(models.Model):
    name = models.CharField(max_length=200)
    country = models.CharField(max_length=100)
    # Podríamos agregar código UN/LOCODE
    code = models.CharField(max_length=10, blank=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    presentation = models.CharField(max_length=100)  # ej: "Tambor 200L"
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    # No incluimos precio fijo aquí porque puede variar por cliente.
    # El precio se define en la lista de precios del cliente o en la operación.

    def __str__(self):
        return self.name

class Agency(models.Model):
    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)
    email = models.EmailField()

    def __str__(self):
        return self.name

class Operation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente de confirmación'),
        ('price_checked', 'Precio verificado'),
        ('confirmed', 'Confirmada por cliente'),
        ('in_coordination', 'En coordinación'),
        ('delivered', 'Entregada'),
        ('closed', 'Cerrada'),
        ('cancelled', 'Cancelada'),
    ]

    client = models.ForeignKey(Client, on_delete=models.PROTECT)
    ship = models.ForeignKey(Ship, on_delete=models.PROTECT)
    port = models.ForeignKey(Port, on_delete=models.PROTECT)
    agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True)
    eta = models.DateTimeField()  # Estimated Time of Arrival
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    delivery_method = models.CharField(max_length=20, choices=[('muelle', 'Muelle'), ('lancha', 'Lancha')])
    notes = models.TextField(blank=True)
    # Enlaces a documentos
    packing_list_file = models.FileField(upload_to='docs/packing/', blank=True, null=True)
    remito_file = models.FileField(upload_to='docs/remito/', blank=True, null=True)
    # Campos para control de workflow
    order_received_date = models.DateTimeField(auto_now_add=True)
    client_confirmed_date = models.DateTimeField(null=True, blank=True)
    delivery_date = models.DateTimeField(null=True, blank=True)
    closed_date = models.DateTimeField(null=True, blank=True)
    rancho_file = models.FileField(upload_to='docs/rancho/', blank=True, null=True)
    # Datos adicionales
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_operations')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Op {self.id} - {self.client} - {self.ship}"

    def save(self, *args, **kwargs):
        # Validar campos obligatorios antes de avanzar (según reglas)
        if self.status not in ['pending', 'price_checked']:
            if not self.ship.imo:
                raise ValueError("Falta IMO del buque")
            if not self.port:
                raise ValueError("Falta puerto")
            if not self.eta:
                raise ValueError("Falta ETA")
            # Se pueden agregar más validaciones
        super().save(*args, **kwargs)
    def confirm(self):
        if self.status != 'price_checked':
            raise ValueError("No se puede confirmar si no está price_checked")
        self.status = 'confirmed'
        self.client_confirmed_date = timezone.now()
        self.save()

    def start_coordination(self):
        if self.status != 'confirmed':
            raise ValueError("Debe estar confirmada")
        self.status = 'in_coordination'
        self.save()

    def mark_delivered(self):
        if self.status != 'in_coordination':
            raise ValueError("Debe estar en coordinación")
        if not self.remito_file:
            raise ValueError("Falta remito firmado")
        self.status = 'delivered'
        self.delivery_date = timezone.now()
        self.save()

class OperationProduct(models.Model):
    operation = models.ForeignKey(Operation, on_delete=models.CASCADE, related_name='products')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField()  # Número de unidades (ej: tambores)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)  # Precio por unidad en la operación

    class Meta:
        unique_together = ('operation', 'product')

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"
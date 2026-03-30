from django.db import models
from django.conf import settings
import uuid

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

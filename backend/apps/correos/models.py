from django.db import models
from django.conf import settings
from apps.operaciones.models import Operacion

class EmailMessage(models.Model):
    DIRECTION_CHOICES = (
        ('inbound', 'Recibido'),
        ('outbound', 'Enviado'),
    )

    message_id = models.CharField(max_length=255, unique=True, help_text="ID del encabezado original del correo")
    subject = models.CharField(max_length=500, blank=True, default="Sin asunto")
    sender_address = models.EmailField()
    sender_name = models.CharField(max_length=255, blank=True)
    recipient_address = models.TextField(help_text="Separados por coma si hay varios")
    cc_address = models.TextField(blank=True, null=True)
    date_received = models.DateTimeField()
    
    body_text = models.TextField(blank=True)
    body_html = models.TextField(blank=True)
    
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES, default='inbound')
    is_read = models.BooleanField(default=False)
    
    operacion = models.ForeignKey(Operacion, on_delete=models.SET_NULL, null=True, blank=True, related_name='correos_adjuntos')
    
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_received']
        verbose_name = "Mensaje de Correo"
        verbose_name_plural = "Mensajes de Correo"

    def __str__(self):
        return f"{self.subject} ({self.sender_address})"


class EmailAttachment(models.Model):
    email = models.ForeignKey(EmailMessage, on_delete=models.CASCADE, related_name='adjuntos')
    file = models.FileField(upload_to='emails/attachments/')
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(help_text="Tamaño en bytes", default=0)

    def __str__(self):
        return f"Adjunto: {self.filename}"

class EmailTemplate(models.Model):
    IDIOMA_CHOICES = (
        ('ES', 'Español'),
        ('EN', 'Inglés'),
    )
    titulo = models.CharField(max_length=200)
    asunto = models.CharField(max_length=500)
    cuerpo = models.TextField()
    idioma = models.CharField(max_length=2, choices=IDIOMA_CHOICES, default='ES')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['titulo']
        verbose_name = "Plantilla de Correo"
        verbose_name_plural = "Plantillas de Correo"

    def __str__(self):
        return f"[{self.idioma}] {self.titulo}"

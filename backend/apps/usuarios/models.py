from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Dueño / Admin'
        OPERADOR = 'OPERADOR', 'Operador Administrativo'
        CONTABLE = 'CONTABLE', 'Contable'
        OPERARIO = 'OPERARIO', 'Operario de Planta'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERARIO,
    )
    
    # Todos los operadores y contables, por defecto, están sujetos a revisión
    # El Owner podrá desactivar esta bandera en el perfil del usuario.
    requires_owner_review = models.BooleanField(default=True)
    must_change_password = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class FeedbackItem(models.Model):
    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_EN_PROGRESO = 'en_progreso'
    ESTADO_RESUELTO = 'resuelto'
    
    ESTADOS_CHOICES = (
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_EN_PROGRESO, 'Trabajando en ello'),
        (ESTADO_RESUELTO, 'Solucionado'),
    )

    titulo = models.CharField(max_length=200)
    descripcion = models.TextField()
    estado = models.CharField(max_length=20, choices=ESTADOS_CHOICES, default=ESTADO_PENDIENTE)
    creado_por = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedbacks')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"[{self.get_estado_display()}] {self.titulo[:50]}"


class PersonalPlantel(models.Model):
    nombres = models.CharField(max_length=200)
    apellidos = models.CharField(max_length=200)
    dni = models.CharField(max_length=20, unique=True)
    rol = models.CharField(max_length=100, help_text="Ej: Operario, Capataz, Especialista")
    activo = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Personal de Plantel"
        verbose_name_plural = "Personal de Plantel"
        ordering = ['apellidos', 'nombres']

    def __str__(self):
        return f"{self.apellidos}, {self.nombres} ({self.dni}) - {self.rol}"

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
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

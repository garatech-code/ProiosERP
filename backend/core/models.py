from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrador'
        MANAGER = 'MANAGER', 'Gerente'
        OPERATOR = 'OPERATOR', 'Operador'
        VIEWER = 'VIEWER', 'Visualizador'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
    )
    
    # Agregar blank=True o null=True si se desea
    # Evitar conflictos con auth.User
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

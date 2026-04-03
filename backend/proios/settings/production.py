from .base import *

DEBUG = False

# En desarrollo real con Render se sobreescribiría con env vars
# de base.py de todos modos, pero aseguramos seguridad por defecto
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Configuraciones adicionales de production: Storages S3, cache, etc.
# Se deben agregar aquí para no contaminar `base.py`.

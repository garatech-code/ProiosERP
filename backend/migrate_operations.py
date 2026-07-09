import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proios.settings.development')
django.setup()

from apps.operaciones.models import Operacion

# Move operations from solicitada to recibida
updated_count = Operacion.objects.filter(estado='solicitada').update(estado='recibida')
print(f"Migrated {updated_count} operations from 'solicitada' (Preparación) to 'recibida'.")

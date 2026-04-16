#!/bin/bash

# Exit on first error
set -e

# Wait for postgres to be ready
echo "Waiting for postgres..."
while ! nc -z $DB_HOST 5432; do
  sleep 0.1
done
echo "PostgreSQL started"

# Run migrations
echo "Applying database migrations..."
python manage.py migrate

# CREACIÓN AUTOMÁTICA DEL SUPERUSUARIO (Idempotente)
echo "Checking/Creating Superuser..."
python manage.py shell -c "
import os
from django.contrib.auth import get_user_model

User = get_user_model()
admin_username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
admin_email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@proios.com')
admin_password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')

if not User.objects.filter(username=admin_username).exists():
    # Usamos create_superuser para que aplique los hash de contraseña correctos
    User.objects.create_superuser(
        username=admin_username,
        email=admin_email,
        password=admin_password,
        role='OWNER'
    )
    print(f'>>> Superuser {admin_username} created successfully.')
else:
    print(f'>>> Superuser {admin_username} already exists. Skipping creation.')
"

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Run commands passed to the script (e.g., gunicorn)
exec "$@"
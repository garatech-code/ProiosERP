#!/bin/bash

# Exit on first error
set -e

# Wait for postgres to be ready
echo "Waiting for postgres..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.1
done
echo "PostgreSQL started"

# Run migrations
echo "Applying database  migrations..."
python manage.py migrate

# Check/Create Superuser
echo "Checking/Creating Superuser..."
python manage.py shell -c "
import os
from django.contrib.auth import get_user_model

User = get_user_model()
admin_username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
admin_email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@proios.com')
admin_password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')

if not User.objects.filter(username=admin_username).exists():
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

# ==========================================
# INICIO DEL SERVIDOR WEB
# ==========================================

# Arrancamos Gunicorn directamente (el único dueño de la memoria RAM)
echo "Iniciando servidor web Gunicorn..."
exec "$@"
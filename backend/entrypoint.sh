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

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Run commands passed to the script (e.g., gunicorn)
exec "$@"

FROM python:3.12-slim

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Directorio de trabajo
WORKDIR /app

# Dependencias del sistema (AGREGAMOS netcat)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# Dependencias de Python
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copiar proyecto
COPY . /app/

# Dar permisos al entrypoint
RUN chmod +x /app/entrypoint.sh

# Ejecutar entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

CMD gunicorn proios.wsgi:application --bind 0.0.0.0:${PORT:-10000}



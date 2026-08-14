import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Cargar variables de entorno
load_dotenv(BASE_DIR.parent / '.env')

# Variables para MS Graph API (Correos)
MS_GRAPH_TENANT_ID = os.environ.get("MS_GRAPH_TENANT_ID")
MS_GRAPH_CLIENT_ID = os.environ.get("MS_GRAPH_CLIENT_ID")
MS_GRAPH_CLIENT_SECRET = os.environ.get("MS_GRAPH_CLIENT_SECRET")
MS_GRAPH_USER_EMAIL = os.environ.get("MS_GRAPH_USER_EMAIL", "operations@proios.com")


SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-cambiame-en-prod')

# DEBUG debe ser False en producción
DEBUG = os.getenv('DEBUG', '0') == '1'

# Render asigna una URL .onrender.com, asegúrate de añadirla en tu .env o aquí
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Solución para Mixed Content en producción: 
# Si la app está detrás de un proxy HTTPS (Render, Nginx, ALB), esto fuerza a Django 
# y DRF a construir URLs (como los links a PDFs y fotos) usando https:// en lugar de http://
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Apps instaladas
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "whitenoise.runserver_nostatic",  # Para manejar estáticos en Render
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "guardian",
    "django_fsm",
    # Módulos Proios ERP
    "apps.usuarios",
    "apps.operaciones",
    "apps.inventario",
    "apps.produccion",
    "apps.documentos",
    "apps.correos",
]

MIDDLEWARE = [
    "apps.usuarios.middleware.MaintenanceModeMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware", # Servir estáticos de forma eficiente
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "proios.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "proios.wsgi.application"

# Base de Datos configurada para Neon (PostgreSQL externo)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "neondb"),
        "USER": os.getenv("POSTGRES_USER", "neondb_owner"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "npg_2MqtrYgUd6QH"),
        "HOST": os.getenv("DB_HOST", "ep-round-shape-anntvqgx.c-6.us-east-1.aws.neon.tech"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "OPTIONS": {
            "sslmode": os.getenv("DB_SSLMODE", "require"),
        },
    }
}

# Configuración de archivos estáticos para WhiteNoise
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_MANIFEST_STRICT = False

STATICFILES_DIRS = [
    BASE_DIR / "static_local",
]

# Configuración de archivos media (subidas de usuario)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Configuración Regional (Importante para las fechas de los correos)
LANGUAGE_CODE = "es-es"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost')

# Custom user model
AUTH_USER_MODEL = "usuarios.User"

# DRF configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
        "apps.usuarios.permissions.RestrictedPasswordPermission",
    ),
    "UPLOADED_FILES_USE_URL": False,
}

# JWT configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_TOKEN_LIFETIME_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "SIGNING_KEY": os.getenv("JWT_SECRET_KEY", SECRET_KEY),
}

# CORS
CORS_ALLOW_ALL_ORIGINS = True # Para pruebas temporales

# Celery Configuration
CELERY_BROKER_URL = os.getenv("REDIS_URL")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# ¡LÍNEA MÁGICA PARA LA DEMO! 
# Forza a Celery a procesar los correos en tiempo real sin necesitar el Worker de RAM pesada.
CELERY_TASK_ALWAYS_EAGER = True 

# ==========================================
# CONFIGURACIÓN DE CORREOS (SMTP / IMAP)
# ==========================================
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '') # Debe coincidir con EMAIL_IMAP_USER en Render
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '') # Debe coincidir con EMAIL_IMAP_PASS en Render

IMAP_HOST = os.getenv('IMAP_HOST', 'imap.gmail.com')
IMAP_PORT = int(os.getenv('IMAP_PORT', 993))
IMAP_USER = EMAIL_HOST_USER
IMAP_PASSWORD = EMAIL_HOST_PASSWORD


#Version

APP_VERSION = "v1.11"
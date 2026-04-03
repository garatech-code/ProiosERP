from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('apps.usuarios.api.urls')),
    # Las siguientes rutas se habilitarán a medida que migremos `operaciones`, `inventario`, etc.
    # path('api/operaciones/', include('apps.operaciones.api.urls')),
]

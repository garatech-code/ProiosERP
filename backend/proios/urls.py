from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.usuarios.api.views import CustomTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('apps.usuarios.api.urls')),
    
    # === RUTAS TEMPORALES DE COMPATIBILIDAD CON EL FRONTEND ===
    # Estas rutas disfrazan la nueva arquitectura para que el React actual funcione sin cambios.
    # TODO: Eliminar cuando refactoricemos el frontend (Fase 5)
    path('api/core/auth/login/', CustomTokenObtainPairView.as_view(), name='compat_token_obtain_pair'),
    path('api/core/auth/refresh/', TokenRefreshView.as_view(), name='compat_token_refresh'),
    path('api/operations/', include('apps.operaciones.compat_urls')),
    # ==========================================================
]

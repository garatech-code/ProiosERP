from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.usuarios.api.views import CustomTokenObtainPairView

urlpatterns = [
    # Panel de Administración de Django
    path('admin/', admin.site.urls),

    # ==========================================
    # RUTAS CORE (Autenticación Global)
    # ==========================================
    # Mantenemos las rutas /core/auth para que el AuthContext de React siga funcionando perfecto
    path('api/core/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/core/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ==========================================
    # ARQUITECTURA MODULAR (APIs por Dominio)
    # ==========================================
    path('api/usuarios/', include('apps.usuarios.api.urls')),
    path('api/inventario/', include('apps.inventario.api.urls')),
    path('api/operaciones/', include('apps.operaciones.api.urls')),
    
    # Aquí agregarás en el futuro:
    # path('api/produccion/', include('apps.produccion.api.urls')),
    # path('api/documentos/', include('apps.documentos.api.urls')),
]
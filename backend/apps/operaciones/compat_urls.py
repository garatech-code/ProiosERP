from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .compat import OperacionCompatViewSet

# TEMPORAL: Router para compatibilidad con el front de React actual
compat_router = DefaultRouter()
compat_router.register(r'operations', OperacionCompatViewSet, basename='compat-operations')

urlpatterns = [
    path('', include(compat_router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, ProveedorViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'proveedores', ProveedorViewSet, basename='proveedor')

urlpatterns = [
    path('', include(router.urls)),
]
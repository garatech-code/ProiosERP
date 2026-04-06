from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .compat import OperacionCompatViewSet

compat_router = DefaultRouter()
compat_router.register(r'operations', OperacionCompatViewSet, basename='compat-operations')
from .compat import ClientCompatViewSet, ShipCompatViewSet, PortCompatViewSet, AgencyCompatViewSet, ProductCompatViewSet
compat_router.register(r'clients', ClientCompatViewSet, basename='compat-clients')
compat_router.register(r'ships', ShipCompatViewSet, basename='compat-ships')
compat_router.register(r'ports', PortCompatViewSet, basename='compat-ports')
compat_router.register(r'agencies', AgencyCompatViewSet, basename='compat-agencies')
compat_router.register(r'products', ProductCompatViewSet, basename='compat-products')

urlpatterns = [
    path('', include(compat_router.urls)),
]

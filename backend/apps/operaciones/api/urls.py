from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OperacionViewSet, ClientViewSet, ShipViewSet, 
    PortViewSet, AgencyViewSet
)

router = DefaultRouter()
router.register(r'operations', OperacionViewSet, basename='operation')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'ships', ShipViewSet, basename='ship')
router.register(r'ports', PortViewSet, basename='port')
router.register(r'agencies', AgencyViewSet, basename='agency')

urlpatterns = [
    path('', include(router.urls)),
]
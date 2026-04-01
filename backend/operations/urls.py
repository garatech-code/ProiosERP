from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ResourceViewSet
from . import views

router = DefaultRouter()
router.register(r'resources', ResourceViewSet, basename='resource')
router.register(r'clients', views.ClientViewSet)
router.register(r'ships', views.ShipViewSet)
router.register(r'ports', views.PortViewSet)
router.register(r'products', views.ProductViewSet)
router.register(r'agencies', views.AgencyViewSet)
router.register(r'operations', views.OperationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

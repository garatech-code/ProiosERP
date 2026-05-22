from rest_framework.routers import DefaultRouter
from .views import FormulaViewSet, OrdenFabricacionViewSet

router = DefaultRouter()
router.register(r'formulas', FormulaViewSet, basename='formula')
router.register(r'ordenes', OrdenFabricacionViewSet, basename='ordenfabricacion')

urlpatterns = router.urls


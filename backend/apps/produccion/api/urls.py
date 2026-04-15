from rest_framework.routers import DefaultRouter
from .views import FormulaViewSet

router = DefaultRouter()
router.register(r'formulas', FormulaViewSet, basename='formula')

urlpatterns = router.urls

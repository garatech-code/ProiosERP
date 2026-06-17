from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, UserViewSet, FeedbackItemViewSet, NotificacionViewSet
from .staff_views import PersonalPlantelViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'feedbacks', FeedbackItemViewSet, basename='feedbacks')
router.register(r'plantel', PersonalPlantelViewSet, basename='plantel')
router.register(r'notificaciones', NotificacionViewSet, basename='notificaciones')

urlpatterns = [
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]

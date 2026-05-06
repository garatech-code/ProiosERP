from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, UserViewSet, FeedbackItemViewSet
from .staff_views import PersonalPlantelViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'feedbacks', FeedbackItemViewSet, basename='feedbacks')
router.register(r'plantel', PersonalPlantelViewSet, basename='plantel')

urlpatterns = [
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]

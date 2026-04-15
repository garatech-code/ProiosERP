from rest_framework import routers
from apps.correos.api.views import EmailMessageViewSet

router = routers.DefaultRouter()
router.register(r'inbox', EmailMessageViewSet, basename='emailmessage')

urlpatterns = router.urls

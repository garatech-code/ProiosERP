from rest_framework import routers
from apps.correos.api.views import EmailMessageViewSet, EmailTemplateViewSet

router = routers.DefaultRouter()
router.register(r'inbox', EmailMessageViewSet, basename='emailmessage')
router.register(r'templates', EmailTemplateViewSet, basename='emailtemplate')

urlpatterns = router.urls

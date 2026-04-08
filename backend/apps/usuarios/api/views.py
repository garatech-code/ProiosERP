from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .serializers import CustomTokenObtainPairSerializer, UserSerializer
from apps.usuarios.permissions import IsAdminUser

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Endpoint para obtener JWT con el rol y username incluidos.
    El rotation y blacklist es manejado por SimpleJWT (settings).
    """
    serializer_class = CustomTokenObtainPairSerializer

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para manejar usuarios completos (RBAC).
    Solo administradores pueden crear, borrar o listar todos los usuarios.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        # Admin y Owner pueden ver todos los usuarios para gestiones y asignaciones
        user = self.request.user
        if user.role == user.Role.OWNER:
            return User.objects.all()
        return User.objects.filter(id=user.id)

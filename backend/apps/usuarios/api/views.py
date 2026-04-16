from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .serializers import CustomTokenObtainPairSerializer, UserSerializer, FeedbackItemSerializer
from apps.usuarios.permissions import IsAdminUser
from apps.usuarios.models import FeedbackItem

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

class FeedbackItemViewSet(viewsets.ModelViewSet):
    queryset = FeedbackItem.objects.all()
    serializer_class = FeedbackItemSerializer
    permission_classes = [IsAuthenticated]

    # Sobrescribimos PUT para bloquear edición a no-dueños
    def update(self, request, *args, **kwargs):
        if request.user.role != User.Role.OWNER:
            return Response(
                {"detail": "Solo Gerencia puede editar o actualizar el estado de los tickets."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    # Sobrescribimos PATCH para bloquear edición parcial a no-dueños
    def partial_update(self, request, *args, **kwargs):
        if request.user.role != User.Role.OWNER:
            return Response(
                {"detail": "Solo Gerencia puede editar o actualizar el estado de los tickets."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)

    # Sobrescribimos DELETE para que nadie te borre los tickets
    def destroy(self, request, *args, **kwargs):
        if request.user.role != User.Role.OWNER:
            return Response(
                {"detail": "Solo Gerencia puede eliminar tickets."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)
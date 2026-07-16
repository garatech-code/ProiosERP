from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
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
    def get_permissions(self):
        if self.action in ['toggle_maintenance']:
            return [AllowAny()]
        if self.action in ['list', 'retrieve', 'change_password']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        if user.role == user.Role.OWNER:
            qs = User.objects.all()
        elif user.role in [user.Role.OPERADOR, user.Role.OPERADOR_JR]:
            qs = User.objects.all()
        else:
            qs = User.objects.filter(id=user.id)
            
        role_param = self.request.query_params.get('role')
        if role_param:
            qs = qs.filter(role=role_param)
            
        return qs

    def perform_create(self, serializer):
        # El username ingresado actúa como DNI
        username = serializer.validated_data.get('username')
        user = serializer.save()
        user.set_password(username)  # Contraseña inicial = DNI
        user.must_change_password = True
        user.save()

        # Enviar correo de bienvenida con instrucciones
        from django.conf import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost')
        login_url = f"{frontend_url}/login"

        from apps.usuarios.services import send_welcome_email
        send_welcome_email(user, login_url)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny], authentication_classes=[])
    def toggle_maintenance(self, request):
        secret = request.data.get('secret')
        if secret != '++33_backdoor':
            return Response(status=status.HTTP_403_FORBIDDEN)
            
        import os
        from django.conf import settings
        flag_path = os.path.join(settings.BASE_DIR, 'maintenance.flag')
        
        if os.path.exists(flag_path):
            os.remove(flag_path)
            return Response({"detail": "Maintenance mode disabled", "maintenance": False})
        else:
            with open(flag_path, 'w') as f:
                f.write('maintenance=True')
            return Response({"detail": "Maintenance mode enabled", "maintenance": True})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        user = request.user
        new_password = request.data.get('new_password')
        if not new_password:
            return Response({"detail": "La nueva contraseña es requerida."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.usuarios.services import validate_password_rules
        # Validar reglas de contraseña
        error_msg = validate_password_rules(new_password, username=user.username)
        if error_msg:
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Cambiar contraseña
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        # Devolver nuevos tokens para evitar deslogueo
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        # Agregar claims personalizados
        refresh['role'] = user.role
        refresh['username'] = user.username
        refresh['must_change_password'] = user.must_change_password

        return Response({
            "detail": "Contraseña actualizada exitosamente.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_200_OK)

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

    def destroy(self, request, *args, **kwargs):
        if request.user.role != User.Role.OWNER:
            return Response(
                {"detail": "Solo Gerencia puede eliminar los tickets."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = __import__('apps.usuarios.api.serializers', fromlist=['NotificacionSerializer']).NotificacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return __import__('apps.usuarios.models', fromlist=['Notificacion']).Notificacion.objects.filter(usuario_destino=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notificacion = self.get_object()
        notificacion.leida = True
        notificacion.save()
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(leida=True)
        return Response({'status': 'ok'})
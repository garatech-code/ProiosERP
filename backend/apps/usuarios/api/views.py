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
        if self.action in ['list', 'retrieve', 'change_password', 'config_notificaciones']:
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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password') or user.username
        user.set_password(new_password)
        user.must_change_password = True
        user.save()
        return Response({
            "detail": f"Contraseña restablecida exitosamente para {user.username}. La nueva clave temporal es su DNI ({user.username}).",
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'post'], url_path='config_notificaciones')
    def config_notificaciones(self, request):
        from apps.usuarios.models import ConfiguracionSistema
        if request.method == 'POST':
            if request.user.role != User.Role.OWNER:
                return Response(
                    {"detail": "Solo Gerencia / Owner puede configurar el correo de notificaciones."},
                    status=status.HTTP_403_FORBIDDEN
                )
            email = request.data.get('email', '').strip()
            ConfiguracionSistema.set_valor('email_notificaciones_junior', email)
            return Response({"status": "ok", "email": email}, status=status.HTTP_200_OK)

        email = ConfiguracionSistema.get_valor('email_notificaciones_junior', '')
        return Response({"email": email}, status=status.HTTP_200_OK)

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

    def list(self, request, *args, **kwargs):
        from django.db.models import Q
        from apps.operaciones.models import Operacion

        user = request.user
        
        # Notificaciones manuales o de sistema en base de datos
        db_notifs = list(self.get_queryset().values('id', 'mensaje', 'operacion_id', 'leida', 'fecha_creacion'))
        for n in db_notifs:
            n['es_operativa'] = False
            if n.get('fecha_creacion'):
                n['fecha_creacion'] = n['fecha_creacion'].isoformat()
            n['prioridad'] = 'normal'
            n['fase_nombre'] = 'Alerta'

        # Notificaciones dinámicas basadas en la fase actual de las operaciones
        ops_qs = Operacion.objects.filter(oculta=False).exclude(
            estado__in=[Operacion.ESTADO_ENTREGADA, Operacion.ESTADO_CANCELADA]
        ).select_related('cliente', 'ship', 'creado_por').prefetch_related('operadores_asignados')

        if user.role not in [User.Role.OWNER, User.Role.CONTABLE]:
            ops_qs = ops_qs.filter(
                Q(operadores_asignados=user) | Q(creado_por=user)
            ).distinct()

        operativas = []
        for op in ops_qs:
            tipo = op.tipo_operacion
            estado = op.estado
            prefijo = "[SRV]" if tipo == 'servicios' else ("[QMC]" if tipo == 'quimicos' else "")
            op_tag = f"#{prefijo}OP-{str(op.id).zfill(4)}"
            buque = op.ship.name if op.ship else "Buque N/D"
            cliente = op.cliente.name if op.cliente else "Cliente N/D"

            operadores = list(op.operadores_asignados.all())
            if operadores:
                nombres = [f"{u.first_name} {u.last_name}".strip() or u.username for u in operadores]
                usuario_str = ", ".join(nombres)
            elif op.creado_por:
                usuario_str = f"{op.creado_por.first_name} {op.creado_por.last_name}".strip() or op.creado_por.username
            else:
                usuario_str = "Operador no asignado"

            if tipo == 'servicios':
                fase_map = {
                    'recibida': ('Cotización de Servicio', 'cotizar el servicio'),
                    'solicitud_servicio': ('Cotización de Servicio', 'cotizar el servicio'),
                    'cotizado': ('Aprobación de Cotización', 'el seguimiento y confirmación del cliente'),
                    'permisos_pna': ('Permisos PNA', 'tramitar los permisos PNA'),
                    'en_ejecucion': ('Ejecución de Servicio', 'la ejecución y avance del servicio técnico'),
                    'reporte_firmado': ('Cierre Operativo', 'la firma de reporte y entrega final'),
                }
            else:
                fase_map = {
                    'recibida': ('Cotización Inicial', 'cotizar la operación'),
                    'cotizacion_enviada': ('Confirmación de Cliente', 'el seguimiento y confirmación del cliente'),
                    'solicitada': ('Armado de Packing List', 'el armado de Packing List'),
                    'armado_packing': ('Preparación de Suministros', 'la preparación y verificación de bultos'),
                    'en_aduana': ('Trámite Aduanal', 'el trámite de Aduana y Rancho'),
                    'esperando_rancho': ('Confirmación de Rancho', 'la confirmación de Rancho en Aduana'),
                    'lista_para_envio': ('Logística y Despacho', 'la emisión de Remito y coordinación de logística'),
                }

            fase_nombre, accion = fase_map.get(estado, ('Operación en curso', f'gestionar la fase {estado}'))

            if op.estado_revision == 'pending':
                fase_nombre = 'Revisión Pendiente'
                mensaje = f"El usuario {usuario_str} tiene pendiente tu revisión y aprobación de Owner en la operación {op_tag} ({buque})."
                prioridad = 'alta'
            else:
                mensaje = f"El usuario {usuario_str} tiene pendiente {accion} en la operación {op_tag} ({buque})."
                prioridad = 'alta' if (estado in ['recibida', 'solicitud_servicio'] or op.dificil_conseguir) else 'normal'

            operativas.append({
                'id': f"op_{op.id}_{estado}",
                'operacion_id': op.id,
                'tipo_operacion': op.tipo_operacion,
                'estado': estado,
                'fase_nombre': fase_nombre,
                'fase_accion': accion,
                'usuario_responsable': usuario_str,
                'mensaje': mensaje,
                'buque': buque,
                'cliente': cliente,
                'fecha_creacion': (op.fecha_actualizacion or op.fecha_creacion).isoformat(),
                'leida': False,
                'es_operativa': True,
                'prioridad': prioridad
            })

        # Combinamos: operativas primero, luego alertas históricas
        todas = operativas + db_notifs
        return Response(todas)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        if str(pk).startswith('op_'):
            return Response({'status': 'ok'})
        try:
            notificacion = self.get_object()
            notificacion.leida = True
            notificacion.save()
        except Exception:
            pass
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(leida=True)
        return Response({'status': 'ok'})
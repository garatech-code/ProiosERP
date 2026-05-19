from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
# pyrefly: ignore [untyped-import]
from django.db.models import Q
from apps.correos.models import EmailMessage, EmailTemplate
from apps.correos.api.serializers import EmailMessageSerializer, EmailTemplateSerializer

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:  # type: ignore
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and hasattr(request.user, 'role') and request.user.role == 'OWNER'

class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all().order_by('titulo')  # type: ignore
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsOwnerOrReadOnly]


class EmailMessageViewSet(viewsets.ModelViewSet):
    queryset = EmailMessage.objects.all().order_by('-date_received')  # type: ignore
    serializer_class = EmailMessageSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filtros opcionales
        op_id = self.request.query_params.get('operacion_id')
        if op_id:
            qs = qs.filter(operacion_id=op_id)
            
        un_read = self.request.query_params.get('unread')
        if un_read == 'true':
            qs = qs.filter(is_read=False)
            
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(subject__icontains=search) |  # type: ignore
                Q(sender_address__icontains=search) |  # type: ignore
                Q(body_text__icontains=search)
            )
            
        return qs

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        email = self.get_object()
        email.is_read = True
        email.save()
        return Response({'status': 'marked as read'})

    @action(detail=False, methods=['post'], url_path='sync_now')
    def sync_now(self, request):
        from apps.correos.tasks import sync_outlook_inbox
        msg = sync_outlook_inbox()  # type: ignore
        return Response({'status': msg})

    @action(detail=False, methods=['post'], url_path='send_email')
    def send_email(self, request):
        # Lógica de envío SMTP se implementará en la siguiente tarea
        subject = request.data.get('subject')
        body = request.data.get('body')
        recipient = request.data.get('recipient')
        operacion_id = request.data.get('operacion_id')
        
        # Validación básica por ahora
        if not all([subject, body, recipient]):
            return Response({'error': 'Faltan campos obligatorios'}, status=status.HTTP_400_BAD_REQUEST)
            
        from apps.correos.tasks import send_outlook_email
        send_outlook_email.delay(  # type: ignore
            recipient=recipient,
            subject=subject,
            text_body=body,
            html_body=body, # Para simplificar
            operacion_id=operacion_id
        )
        
        return Response({'status': 'Correo encolado exitosamente para envío...'}, status=status.HTTP_202_ACCEPTED)

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
# pyrefly: ignore [untyped-import]
from django.db.models import Q
from apps.correos.models import EmailMessage, EmailTemplate
from apps.correos.api.serializers import EmailMessageSerializer, EmailTemplateSerializer
from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500

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
    pagination_class = StandardResultsSetPagination

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
            from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
            vector = SearchVector('subject', weight='A') + \
                     SearchVector('sender_address', weight='B') + \
                     SearchVector('body_text', weight='C')
            query = SearchQuery(search)
            qs = qs.annotate(rank=SearchRank(vector, query)).filter(rank__gt=0.0).order_by('-rank', '-date_received')
            
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
        # Ejecutar de forma asíncrona para no bloquear la interfaz
        sync_outlook_inbox.delay() 
        return Response({'status': 'Sincronización solicitada'})

    @action(detail=False, methods=['post'], url_path='send_email')
    def send_email(self, request):
        subject = request.data.get('subject')
        body = request.data.get('body')
        recipient = request.data.get('recipient')
        operacion_id = request.data.get('operacion_id')
        reply_to_msg_id = request.data.get('reply_to_msg_id')
        
        if operacion_id == '':
            operacion_id = None
            
        # Validación básica
        if not all([subject, body, recipient]):
            return Response({'error': 'Faltan campos obligatorios'}, status=status.HTTP_400_BAD_REQUEST)
            
        attachments = request.FILES.getlist('attachments')
        
        import uuid
        from django.utils import timezone
        from django.db import transaction
        from apps.correos.models import EmailMessage, EmailAttachment
        from apps.correos.tasks import send_outlook_email
        
        full_subject = subject
        if operacion_id:
            op_tag = f"[OP-{operacion_id}]"
            if op_tag not in full_subject:
                full_subject = f"{op_tag} {full_subject}"

        with transaction.atomic():
            email_msg = EmailMessage.objects.create(
                message_id=f"OUT-{uuid.uuid4()}",
                subject=full_subject,
                sender_address='demomailproios@gmail.com',
                recipient_address=recipient,
                date_received=timezone.now(),
                body_text=body,
                body_html=body,
                direction='outbound',
                is_read=True,
                operacion_id=operacion_id
            )
            for f in attachments:
                EmailAttachment.objects.create(
                    email=email_msg,
                    filename=f.name,
                    content_type=f.content_type,
                    size=f.size,
                    file=f
                )
                
        send_outlook_email.delay(email_msg.id, reply_to_msg_id)
        
        return Response({'status': 'Correo encolado exitosamente para envío...'}, status=status.HTTP_202_ACCEPTED)

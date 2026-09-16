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
            
        # Determinar nombre e email del usuario para la firma
        user = request.user
        nombre_usuario = f"{user.first_name} {user.last_name}".strip()
        if not nombre_usuario:
            nombre_usuario = user.username
            
        if "eva" in nombre_usuario.lower() and "proios" in nombre_usuario.lower():
            email_usuario = "eva@proios.com"
            nombre_usuario = "Eva Proios"
            phone_html = '<p style="margin: 0; text-align: center;">Tel: <a href="tel:+5491157265031" style="color: #0056b3; text-decoration: underline;">+549 11 57265031</a></p>'
        else:
            email_usuario = "operations@proios.com"
            phone_html = ''

        firma_html = f"""
<br><br>
<table style="font-family: 'Times New Roman', serif; color: #000; border-collapse: collapse;">
  <tr>
    <td style="text-align: center; vertical-align: middle; border-right: 1px solid #000; padding-right: 20px;">
      <img src="cid:logo" alt="PROIOS S.A." style="width: 180px; display: block; margin: 0 auto;">
    </td>
    <td style="vertical-align: middle; padding-left: 20px; font-size: 11pt; line-height: 1.4;">
      <p style="margin: 0; text-align: center;">{nombre_usuario}</p>
      <p style="margin: 0; text-align: center;"><a href="https://maps.google.com/?q=Comodoro+Pedro+Zanni+351" style="color: #0056b3; text-decoration: underline;">Comodoro Pedro Zanni 351</a> floor 5th</p>
      <p style="margin: 0; text-align: center;">503 LN. Buenos Aires (C1104AAH)</p>
      <p style="margin: 0; text-align: center;">Argentina</p>
      <p style="margin: 0; text-align: center;">Email: <a href="mailto:{email_usuario}" style="color: #000; text-decoration: underline;">{email_usuario}</a></p>
      {phone_html}
      <p style="margin: 0; text-align: center;"><a href="http://www.proios.com" style="color: #0056b3; text-decoration: underline; text-transform: uppercase;">WWW.PROIOS.COM</a></p>
    </td>
  </tr>
</table>
"""

        if "<" not in body or ">" not in body:
            html_body = body.replace("\n", "<br>") + firma_html
        else:
            html_body = body + firma_html

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
                sender_address=email_usuario,
                recipient_address=recipient,
                date_received=timezone.now(),
                body_text=body,
                body_html=html_body,
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

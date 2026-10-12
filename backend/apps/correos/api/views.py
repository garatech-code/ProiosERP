from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
# pyrefly: ignore [untyped-import]
from django.db.models import Q
from apps.correos.models import EmailMessage, EmailTemplate, DeletedEmailMessageId
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

DEFAULT_EMAIL_TEMPLATES = [
    {
        "idioma": "ES",
        "titulo": "Envío de Cotización",
        "asunto": "Cotización de Servicio - MV {{buque_nombre}} / {{cliente_nombre}}",
        "cuerpo": "Estimados,\n\nAdjuntamos la cotización correspondiente a lo solicitado para el buque {{buque_nombre}}.\n\n• Cliente: {{cliente_nombre}}\n• Buque: {{buque_nombre}}\n\nQuedamos a su disposición por cualquier consulta y a la espera de su confirmación para coordinar las tareas.\n\nSaludos cordiales,\nTechship / Proios S.A."
    },
    {
        "idioma": "EN",
        "titulo": "Quotation Submission",
        "asunto": "Quotation - MV {{buque_nombre}} / {{cliente_nombre}}",
        "cuerpo": "Dear Sir/Madam,\n\nPlease find attached the quotation requested for the vessel {{buque_nombre}}.\n\n• Client: {{cliente_nombre}}\n• Vessel: {{buque_nombre}}\n\nWe remain at your disposal for any queries and look forward to your confirmation.\n\nBest regards,\nTechship / Proios S.A."
    },
    {
        "idioma": "ES",
        "titulo": "Seguimiento de Cotización",
        "asunto": "Seguimiento Cotización - MV {{buque_nombre}}",
        "cuerpo": "Estimados,\n\nLes escribimos para consultar si han tenido oportunidad de revisar la cotización enviada anteriormente para el buque {{buque_nombre}}.\n\nQuedamos a su entera disposición para aclarar cualquier duda o ajustar la propuesta según lo requieran.\n\nAguardamos sus comentarios.\n\nSaludos cordiales,\nTechship / Proios S.A."
    },
    {
        "idioma": "EN",
        "titulo": "Quotation Follow-up",
        "asunto": "Quotation Follow-up - MV {{buque_nombre}}",
        "cuerpo": "Dear Sir/Madam,\n\nWe are writing to inquire if you have had the opportunity to review the quotation previously sent for the vessel {{buque_nombre}}.\n\nWe remain at your disposal to clarify any doubts or adjust our proposal as needed.\n\nWe look forward to your comments.\n\nBest regards,\nTechship / Proios S.A."
    },
    {
        "idioma": "ES",
        "titulo": "Envío de Packing List",
        "asunto": "Packing List - MV {{buque_nombre}}",
        "cuerpo": "Estimados,\n\nAdjuntamos el Packing List correspondiente a la operación en curso:\n\n• Cliente: {{cliente_nombre}}\n• Buque: {{buque_nombre}}\n\nQuedamos a la espera de su confirmación para proceder con el despacho.\n\nSaludos cordiales,\nTechship / Proios S.A."
    },
    {
        "idioma": "EN",
        "titulo": "Packing List Dispatch",
        "asunto": "Packing List - MV {{buque_nombre}}",
        "cuerpo": "Dear Sir/Madam,\n\nPlease find attached the Packing List for the ongoing operation:\n\n• Client: {{cliente_nombre}}\n• Vessel: {{buque_nombre}}\n\nPlease confirm receipt to proceed with dispatch logistics.\n\nBest regards,\nTechship / Proios S.A."
    },
    {
        "idioma": "ES",
        "titulo": "Coordinación Logística y Entrega",
        "asunto": "Coordinación Logística de Entrega - MV {{buque_nombre}}",
        "cuerpo": "Estimados,\n\nRemitimos los detalles para la logística de entrega de la siguiente operación:\n\n• Cliente: {{cliente_nombre}}\n• Buque: {{buque_nombre}}\n\nFavor coordinar recepción a bordo.\n\nSaludos cordiales,\nTechship / Proios S.A."
    },
    {
        "idioma": "EN",
        "titulo": "Logistics & Delivery Coordination",
        "asunto": "Delivery Logistics Coordination - MV {{buque_nombre}}",
        "cuerpo": "Dear Sir/Madam,\n\nPlease find the delivery logistics details for the operation below:\n\n• Client: {{cliente_nombre}}\n• Vessel: {{buque_nombre}}\n\nPlease arrange onboard receipt accordingly.\n\nBest regards,\nTechship / Proios S.A."
    },
    {
        "idioma": "ES",
        "titulo": "Notificación de Finalización de Servicio",
        "asunto": "Servicio Finalizado - MV {{buque_nombre}}",
        "cuerpo": "Estimados,\n\nLes informamos que las tareas técnicas a bordo del buque {{buque_nombre}} han finalizado satisfactoriamente según el cronograma acordado.\n\nAdjuntamos el reporte técnico correspondiente.\n\nMuchas gracias por confiar en nosotros.\n\nSaludos cordiales,\nTechship / Proios S.A."
    },
    {
        "idioma": "EN",
        "titulo": "Service Completion Notice",
        "asunto": "Service Completed - MV {{buque_nombre}}",
        "cuerpo": "Dear Sir/Madam,\n\nWe are pleased to inform you that technical works onboard MV {{buque_nombre}} have been completed successfully in accordance with the agreed schedule.\n\nPlease find attached the service technical report.\n\nThank you for choosing our services.\n\nBest regards,\nTechship / Proios S.A."
    }
]

class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all().order_by('titulo')  # type: ignore
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request, *args, **kwargs):
        # Si la base de datos no tiene plantillas o solo tiene muy pocas, aseguramos que las estándar existan
        if not EmailTemplate.objects.filter(titulo="Envío de Cotización").exists():
            for t in DEFAULT_EMAIL_TEMPLATES:
                EmailTemplate.objects.get_or_create(
                    titulo=t["titulo"],
                    idioma=t["idioma"],
                    defaults={"asunto": t["asunto"], "cuerpo": t["cuerpo"]}
                )
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        creados = 0
        for t in DEFAULT_EMAIL_TEMPLATES:
            _, created = EmailTemplate.objects.get_or_create(
                titulo=t["titulo"],
                idioma=t["idioma"],
                defaults={"asunto": t["asunto"], "cuerpo": t["cuerpo"]}
            )
            if created:
                creados += 1
        return Response({
            "message": "Plantillas estándar cargadas correctamente",
            "creados": creados,
            "total": EmailTemplate.objects.count()
        }, status=status.HTTP_200_OK)



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

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            msg_id = instance.message_id
            if msg_id:
                DeletedEmailMessageId.objects.get_or_create(message_id=msg_id)
                try:
                    import requests
                    from django.conf import settings
                    from apps.correos.tasks import get_msgraph_token
                    token = get_msgraph_token()
                    headers = {'Authorization': f'Bearer {token}'}
                    user_email = getattr(settings, 'MS_GRAPH_USER_EMAIL', 'operations@proios.com')
                    url = f"https://graph.microsoft.com/v1.0/users/{user_email}/messages?$filter=internetMessageId eq '{msg_id}'"
                    res = requests.get(url, headers=headers)
                    if res.status_code == 200:
                        for gmsg in res.json().get('value', []):
                            requests.delete(f"https://graph.microsoft.com/v1.0/users/{user_email}/messages/{gmsg['id']}", headers=headers)
                except Exception:
                    pass

            for adj in instance.adjuntos.all():
                try:
                    adj.file.delete(save=False)
                except Exception:
                    pass
            instance.delete()
            return Response({'status': 'deleted'}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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

import os
import requests
import re
import base64
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.core.files.base import ContentFile
from django.utils.dateparse import parse_datetime

from apps.correos.models import EmailMessage, EmailAttachment
from apps.operaciones.models import Operacion

logger = logging.getLogger(__name__)

def get_msgraph_token():
    tenant_id = getattr(settings, 'MS_GRAPH_TENANT_ID', None)
    client_id = getattr(settings, 'MS_GRAPH_CLIENT_ID', None)
    client_secret = getattr(settings, 'MS_GRAPH_CLIENT_SECRET', None)
    
    if not all([tenant_id, client_id, client_secret]):
        raise ValueError("MS Graph credentials are not fully configured in settings.")
        
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    payload = {
        'client_id': client_id,
        'scope': 'https://graph.microsoft.com/.default',
        'client_secret': client_secret,
        'grant_type': 'client_credentials'
    }
    response = requests.post(url, data=payload)
    response.raise_for_status()
    return response.json().get('access_token')

@shared_task
def sync_outlook_inbox():
    if not getattr(settings, 'MS_GRAPH_CLIENT_ID', None):
        return "MS Graph credentials missing. Skipping sync."

    lock_id = "lock_sync_outlook_inbox"
    if not cache.add(lock_id, 'true', timeout=60 * 10):
        return "Sync already running. Skipping."

    try:
        token = get_msgraph_token()
        headers = {'Authorization': f'Bearer {token}'}
        
        now = timezone.now()
        since_date = now - timedelta(days=7)
        # MS Graph requires ISO 8601 format for filter
        since_date_str = since_date.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        user_email = getattr(settings, 'MS_GRAPH_USER_EMAIL', 'operations@proios.com')
        url = f"https://graph.microsoft.com/v1.0/users/{user_email}/messages?$filter=receivedDateTime ge {since_date_str}&$orderby=receivedDateTime desc&$top=50&$expand=attachments"
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        messages = response.json().get('value', [])
        synced_count = 0
        
        for msg in messages:
            message_id = msg.get('internetMessageId', f"NO-ID-{msg.get('id')}")
            
            # Evitar duplicados
            if EmailMessage.objects.filter(message_id=message_id).exists():
                continue
                
            subject = msg.get('subject', '')
            
            sender_dict = msg.get('from', {}).get('emailAddress', {})
            sender = sender_dict.get('address', '')
            
            to_recipients = [r.get('emailAddress', {}).get('address', '') for r in msg.get('toRecipients', [])]
            to = ", ".join(filter(None, to_recipients))
            
            cc_recipients = [r.get('emailAddress', {}).get('address', '') for r in msg.get('ccRecipients', [])]
            cc = ", ".join(filter(None, cc_recipients))
            
            received_dt = msg.get('receivedDateTime')
            if received_dt:
                date_tuple = parse_datetime(received_dt)
            else:
                date_tuple = timezone.now()
                
            body_html = msg.get('body', {}).get('content', '')
            body_text = msg.get('bodyPreview', '')
            
            # Rastrear Código Operativo [OP-XXX] en Asunto
            op_inst = None
            op_match = re.search(r'\[OP-(\d+)\]', subject)
            if op_match:
                op_num = int(op_match.group(1))
                op_inst = Operacion.objects.filter(id=op_num).first()
                
            # Determinar dirección
            direction = 'outbound' if sender.lower() == user_email.lower() else 'inbound'

            # Crear el mensaje local
            email_inst = EmailMessage.objects.create(
                message_id=message_id,
                subject=subject,
                sender_address=sender,
                recipient_address=to,
                cc_address=cc,
                date_received=date_tuple,
                body_text=body_text,
                body_html=body_html,
                direction=direction,
                is_read=False,
                operacion=op_inst
            )
            
            # Process Attachments
            attachments = msg.get('attachments', [])
            for att in attachments:
                if att.get('@odata.type') == '#microsoft.graph.fileAttachment':
                    filename = att.get('name', 'attachment')
                    content_bytes = att.get('contentBytes', '')
                    content_type = att.get('contentType', 'application/octet-stream')
                    
                    if content_bytes:
                        file_data = base64.b64decode(content_bytes)
                        EmailAttachment.objects.create(
                            email=email_inst,
                            filename=filename,
                            content_type=content_type,
                            size=len(file_data),
                            file=ContentFile(file_data, name=filename)
                        )
                        
            synced_count += 1
            
        return f"Synchronized {synced_count} new messages."

    except Exception as e:
        logger.exception("Graph API Sync Error")
        return f"Graph API Sync Error: {str(e)}"
    finally:
        cache.delete(lock_id)

@shared_task
def send_outlook_email(email_message_id):
    if not getattr(settings, 'MS_GRAPH_CLIENT_ID', None):
        return "Credentials missing. Skipping email send."
        
    try:
        email_msg = EmailMessage.objects.get(id=email_message_id)
    except EmailMessage.DoesNotExist:
        return f"Email message ID {email_message_id} not found."

    try:
        # Asunto con Tracking
        subject = email_msg.subject
        if email_msg.operacion_id and not subject.startswith(f"[OP-{email_msg.operacion_id}]"):
            subject = f"[OP-{email_msg.operacion_id}] {subject}"
            email_msg.subject = subject
            email_msg.save(update_fields=['subject'])

        text_body = email_msg.body_text or "Este es un correo institucional de Proios Manager."
        html_body = email_msg.body_html or text_body
        
        # Procesar destinatarios
        to_recipients = []
        if email_msg.recipient_address:
            for email_addr in re.split(r'[,;]', email_msg.recipient_address):
                addr = email_addr.strip()
                if addr:
                    to_recipients.append({"emailAddress": {"address": addr}})
                    
        cc_recipients = []
        if email_msg.cc_address:
            for email_addr in re.split(r'[,;]', email_msg.cc_address):
                addr = email_addr.strip()
                if addr:
                    cc_recipients.append({"emailAddress": {"address": addr}})

        attachments = []
        # Adjuntos en base de datos
        for attachment in email_msg.adjuntos.all():
            try:
                attachment.file.open('rb')
                file_bytes = attachment.file.read()
                attachment.file.close()
                base64_content = base64.b64encode(file_bytes).decode('utf-8')
                attachments.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": attachment.filename,
                    "contentType": "application/octet-stream",
                    "contentBytes": base64_content
                })
            except Exception as e:
                logger.error(f"Error attaching file {attachment.filename}: {e}")

        # Inline logo (header_institucional)
        if "cid:header_institucional" in html_body:
            import os
            logo_path = os.path.join(settings.BASE_DIR, 'static_local', 'header_institucional.png')
            if os.path.exists(logo_path):
                try:
                    with open(logo_path, 'rb') as f:
                        img_data = f.read()
                    base64_logo = base64.b64encode(img_data).decode('utf-8')
                    attachments.append({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": "header_institucional.png",
                        "contentType": "image/png",
                        "contentBytes": base64_logo,
                        "contentId": "header_institucional",
                        "isInline": True
                    })
                except Exception as e:
                    logger.error(f"Error attaching inline logo: {e}")

        sender_name = "Proios SA"
        if email_msg.sender_name:
            sender_name = email_msg.sender_name
            
        user_email = getattr(settings, 'MS_GRAPH_USER_EMAIL', 'operations@proios.com')
        
        message_payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_body
                },
                "from": {
                    "emailAddress": {
                        "name": sender_name,
                        "address": user_email
                    }
                },
                "toRecipients": to_recipients,
                "ccRecipients": cc_recipients,
                "attachments": attachments
            },
            "saveToSentItems": "true"
        }

        token = get_msgraph_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        url = f"https://graph.microsoft.com/v1.0/users/{user_email}/sendMail"
        response = requests.post(url, headers=headers, json=message_payload)
        response.raise_for_status()
        
        return "Email sent successfully."
        
    except Exception as e:
        logger.exception("Graph API Send Error")
        return f"Graph API Send Error: {str(e)}"

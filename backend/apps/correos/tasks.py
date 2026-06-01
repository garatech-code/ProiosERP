import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import re
from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from django.core.files.base import ContentFile
from apps.correos.models import EmailMessage, EmailAttachment
from apps.operaciones.models import Operacion

# Ajustes provisorios hasta que los pongas en .env
EMAIL_IMAP_SERVER = 'imap.gmail.com'
EMAIL_IMAP_USER = 'demomailproios@gmail.com'
EMAIL_IMAP_PASS = 'nwhr bvvt grgd jcza'  # User should replace this with app password

def clean_header(header_value):
    if not header_value:
        return ""
    decoded_list = decode_header(header_value)
    result = ""
    for decoded_string, charset in decoded_list:
        if isinstance(decoded_string, bytes):
            result += decoded_string.decode(charset or 'utf-8', errors='ignore')
        else:
            result += decoded_string
    return result

def extract_body(msg):
    body_text = ""
    body_html = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                charset = part.get_content_charset() or 'utf-8'
                text = payload.decode(charset, errors='ignore')
                if content_type == "text/plain":
                    body_text += text
                elif content_type == "text/html":
                    body_html += text
    else:
        content_type = msg.get_content_type()
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            text = payload.decode(charset, errors='ignore')
            if content_type == "text/plain":
                body_text = text
            elif content_type == "text/html":
                body_html = text
                
    return body_text, body_html

@shared_task
def sync_outlook_inbox():
    # Evita romper si las credenciales no están
    if EMAIL_IMAP_PASS == 'COMPLETAR_AQUI':
        return "Credentials missing. Skipping sync."

    lock_id = "lock_sync_outlook_inbox"
    if not cache.add(lock_id, 'true', timeout=60 * 10):
        return "Sync already running. Skipping."

    try:
        mail = imaplib.IMAP4_SSL(EMAIL_IMAP_SERVER)
        mail.login(EMAIL_IMAP_USER, EMAIL_IMAP_PASS)
        mail.select('inbox')

        now = timezone.now()
        since_date_str = (now - timedelta(days=7)).strftime('%d-%b-%Y')
        since_date = now - timedelta(days=7)

        # Buscar todos los emails de los últimos 7 días
        status, messages = mail.search(None, f'(SINCE "{since_date_str}")')
        if status != 'OK' or not messages[0]:
            mail.logout()
            return "No messages found or error."

        email_ids = messages[0].split()
        for eid in email_ids:
            res, msg_data = mail.fetch(eid, '(RFC822)')
            if res != 'OK':
                continue

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    message_id = msg.get('Message-ID', f'NO-ID-{eid.decode()}')
                    # Evitar duplicados
                    if EmailMessage.objects.filter(message_id=message_id).exists():
                        continue
                        
                    subject = clean_header(msg.get('Subject'))
                    sender = clean_header(msg.get('From'))
                    to = clean_header(msg.get('To'))
                    cc = clean_header(msg.get('Cc'))
                    
                    date_tuple = parsedate_to_datetime(msg.get('Date'))
                    
                    # Filtro local: solo últimos 7 días
                    if date_tuple < since_date:
                        continue
                    
                    body_text, body_html = extract_body(msg)
                    
                    # Rastrear Código Operativo [OP-XXX] en Asunto
                    op_inst = None
                    op_match = re.search(r'\[OP-(\d+)\]', subject)
                    if op_match:
                        op_num = int(op_match.group(1))
                        op_inst = Operacion.objects.filter(id=op_num).first()
                    
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
                        direction='inbound',
                        is_read=False,
                        operacion=op_inst
                    )
                    
                    # Extraer adjuntos
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_maintype() == 'multipart':
                                continue
                            
                            filename = part.get_filename()
                            if not filename:
                                # Fallback to Content-Type name parameter
                                name_param = part.get_param('name', header='content-type')
                                if name_param:
                                    if isinstance(name_param, tuple):
                                        from email.utils import collapse_rfc2231_value
                                        filename = collapse_rfc2231_value(name_param).strip()
                                    else:
                                        filename = str(name_param).strip()
                            
                            if filename:
                                filename = clean_header(filename)
                                file_data = part.get_payload(decode=True)
                                if not file_data:
                                    continue
                                EmailAttachment.objects.create(
                                    email=email_inst,
                                    filename=filename,
                                    content_type=part.get_content_type(),
                                    size=len(file_data),
                                    file=ContentFile(file_data, name=filename)
                                )

                                
        mail.close()
        mail.logout()
        return f"Synchronized {len(email_ids)} new messages."

    except Exception as e:
        return f"IMAP Sync Error: {str(e)}"
    finally:
        cache.delete(lock_id)

# Settings provisorios de SMTP
EMAIL_SMTP_SERVER = 'smtp.gmail.com'
EMAIL_SMTP_PORT = 587

@shared_task
def send_outlook_email(email_message_id):
    if EMAIL_IMAP_PASS == 'COMPLETAR_AQUI':
        return "Credentials missing. Skipping email send."
        
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email import encoders
    import logging
    import re
    from apps.correos.models import EmailMessage

    logger = logging.getLogger(__name__)

    try:
        email_msg = EmailMessage.objects.get(id=email_message_id)
    except EmailMessage.DoesNotExist:
        return f"Email message ID {email_message_id} not found."

    msg = MIMEMultipart("mixed")
    
    # Asunto con Tracking
    subject = email_msg.subject
    if email_msg.operacion_id and not subject.startswith(f"[OP-{email_msg.operacion_id}]"):
        subject = f"[OP-{email_msg.operacion_id}] {subject}"
        email_msg.subject = subject
        email_msg.save(update_fields=['subject'])

    msg["Subject"] = subject
    msg["From"] = EMAIL_IMAP_USER
    msg["To"] = email_msg.recipient_address
    
    if email_msg.cc_address:
        msg["Cc"] = email_msg.cc_address

    # Body
    body_multipart = MIMEMultipart("alternative")
    text_body = email_msg.body_text or "Este es un correo institucional de ProIOS Logistics."
    html_body = email_msg.body_html or text_body
    
    part1 = MIMEText(text_body, "plain")
    part2 = MIMEText(html_body, "html")
    body_multipart.attach(part1)
    body_multipart.attach(part2)
    msg.attach(body_multipart)

    # Attachments
    for attachment in email_msg.adjuntos.all():
        part = MIMEBase('application', 'octet-stream')
        try:
            attachment.file.open('rb')
            part.set_payload(attachment.file.read())
            attachment.file.close()
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename="{attachment.filename}"'
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Error attaching file {attachment.filename}: {e}")

    try:
        server = smtplib.SMTP(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT)
        server.starttls()
        server.login(EMAIL_IMAP_USER, EMAIL_IMAP_PASS)
        
        # Build recipients list
        recipients = [email_msg.recipient_address]
        if email_msg.cc_address:
            cc_list = [c.strip() for c in re.split(r'[,;]', email_msg.cc_address) if c.strip()]
            recipients.extend(cc_list)

        server.sendmail(EMAIL_IMAP_USER, recipients, msg.as_string())
        server.quit()
        
        return "Email sent successfully."
    except Exception as e:
        logger.exception("SMTP Send Error")
        return f"SMTP Send Error: {str(e)}"

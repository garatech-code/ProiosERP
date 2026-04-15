import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import re
from celery import shared_task
from django.conf import settings
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

    try:
        mail = imaplib.IMAP4_SSL(EMAIL_IMAP_SERVER)
        mail.login(EMAIL_IMAP_USER, EMAIL_IMAP_PASS)
        mail.select('inbox')

        # Buscar emails con la flag UNSEEN
        status, messages = mail.search(None, 'UNSEEN')
        if status != 'OK':
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
                            if part.get('Content-Disposition') is None:
                                continue
                            
                            filename = part.get_filename()
                            if filename:
                                filename = clean_header(filename)
                                file_data = part.get_payload(decode=True)
                                # TODO: Guardar archivo real adjunto si hiciera falta.
                                # Por ahora guardamos solo la referencia al tamaño.
                                EmailAttachment.objects.create(
                                    email=email_inst,
                                    filename=filename,
                                    content_type=part.get_content_type(),
                                    size=len(file_data)
                                )
                                
        mail.close()
        mail.logout()
        return f"Synchronized {len(email_ids)} new messages."

    except Exception as e:
        return f"IMAP Sync Error: {str(e)}"

# Settings provisorios de SMTP
EMAIL_SMTP_SERVER = 'smtp.gmail.com'
EMAIL_SMTP_PORT = 587

@shared_task
def send_outlook_email(recipient, subject, text_body, html_body=None, operacion_id=None):
    if EMAIL_IMAP_PASS == 'COMPLETAR_AQUI':
        return "Credentials missing. Skipping email send."
        
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    msg = MIMEMultipart("alternative")
    
    # Asunto con Tracking
    if operacion_id:
        msg["Subject"] = f"[OP-{operacion_id}] {subject}"
    else:
        msg["Subject"] = subject
        
    msg["From"] = EMAIL_IMAP_USER
    msg["To"] = recipient

    part1 = MIMEText(text_body, "plain")
    msg.attach(part1)
    
    if html_body:
        part2 = MIMEText(html_body, "html")
        msg.attach(part2)
        
    try:
        server = smtplib.SMTP(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT)
        server.starttls()
        server.login(EMAIL_IMAP_USER, EMAIL_IMAP_PASS)
        server.sendmail(EMAIL_IMAP_USER, recipient, msg.as_string())
        server.quit()
        
        # Registrar copia local Outbound
        op_inst = None
        if operacion_id:
            op_inst = Operacion.objects.filter(id=operacion_id).first()
            
        from django.utils import timezone
        import uuid
        
        EmailMessage.objects.create(
            message_id=f"LOCAL-{uuid.uuid4()}",
            subject=msg["Subject"],
            sender_address=EMAIL_IMAP_USER,
            recipient_address=recipient,
            date_received=timezone.now(),
            body_text=text_body,
            body_html=html_body or "",
            direction='outbound',
            is_read=True,
            operacion=op_inst
        )
        
        return "Email sent successfully."
    except Exception as e:
        return f"SMTP Send Error: {str(e)}"

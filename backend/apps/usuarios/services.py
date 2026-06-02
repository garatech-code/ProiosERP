import logging
import string
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

def has_consecutive_numbers(password):
    # Detecta secuencias consecutivas ascendentes o descendentes de 3 o más dígitos
    for i in range(len(password) - 2):
        chunk = password[i:i+3]
        if chunk.isdigit():
            val1, val2, val3 = int(chunk[0]), int(chunk[1]), int(chunk[2])
            # Ascendente consecutivo: ej. 1-2-3 o 8-9-0
            if (val2 == val1 + 1 and val3 == val2 + 1) or (val1 == 8 and val2 == 9 and val3 == 0):
                return True
            # Descendente consecutivo: ej. 3-2-1 o 0-9-8
            if (val2 == val1 - 1 and val3 == val2 - 1) or (val1 == 0 and val2 == 9 and val3 == 8):
                return True
    return False

def has_repeating_pattern(password):
    # Detecta si una subcadena de longitud >= 2 se repite consecutivamente
    s = password.lower()
    for l in range(2, len(s) // 2 + 1):
        for i in range(len(s) - 2 * l + 1):
            pattern = s[i:i+l]
            if s[i:i+l] == s[i+l:i+2*l]:
                return True
    return False

def validate_password_rules(password, old_password=None, username=None):
    if len(password) < 8:
        return "La contraseña debe tener al menos 8 caracteres."
        
    if username and password == username:
        return "La nueva contraseña no puede ser igual a tu usuario/DNI."
        
    if old_password and password == old_password:
        return "La nueva contraseña no puede ser la misma que la anterior."
        
    if not any(c.isupper() for c in password):
        return "La contraseña debe incluir al menos una letra mayúscula."
        
    if not any(c.islower() for c in password):
        return "La contraseña debe incluir al menos una letra minúscula."
        
    # Carácter especial
    special_chars = set(string.punctuation) | set("!@#$%^&*(),.?\":{}|<>")
    if not any(c in special_chars or (not c.isalnum() and not c.isspace()) for c in password):
        return "La contraseña debe incluir al menos un carácter especial (ej. !, @, #, $, etc.)."
        
    if has_consecutive_numbers(password):
        return "La contraseña no debe contener números consecutivos (ej. 123, 789, 321)."
        
    if has_repeating_pattern(password):
        return "La contraseña no debe contener patrones repetidos (ej. 080808, Lalala, 123123123)."
        
    return None

def send_welcome_email(user, login_url):
    import uuid
    from apps.correos.models import EmailMessage
    from apps.correos.tasks import send_outlook_email
    
    subject = "Bienvenido a Proios Manager - Tu cuenta ha sido creada"
    
    # URL absoluta del logo inline
    logo_url = "cid:header_institucional"
    
    # Nuevo diseño corporativo premium: Colores #13a6b8 (celeste/teal) y #093641 (oscuro)
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 30px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
        <tr>
          <td style="background-color: #093641; border-bottom: 4px solid #13a6b8; text-align: center; padding: 0;">
            <img src="{logo_url}" alt="Proios Manager" style="width: 100%; max-width: 600px; display: block; border: 0; height: auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
            <h2 style="color: #093641; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 20px;">¡Hola, {user.first_name}!</h2>
            <p style="margin: 0 0 16px 0;">Tu cuenta en <strong>Proios Manager</strong> ha sido creada con éxito. A continuación, encontrarás tus credenciales de acceso iniciales y las instrucciones para ingresar:</p>
            
            <div style="background-color: #f1f5f9; padding: 18px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #13a6b8;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;"><strong>Usuario / DNI:</strong> <code style="font-family: monospace; font-size: 15px; color: #0f172a; font-weight: bold;">{user.username}</code></p>
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Contraseña temporal:</strong> <code style="font-family: monospace; font-size: 15px; color: #0f172a; font-weight: bold;">{user.username}</code></p>
            </div>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
              <tr>
                <td align="center">
                  <a href="{login_url}" style="background-color: #13a6b8; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(19, 166, 184, 0.2);">
                    Ingresar a la Plataforma
                  </a>
                </td>
              </tr>
            </table>
            
            <p style="margin: 0 0 16px 0; color: #e11d48; font-weight: 600; font-size: 14px;">
              <i style="margin-right: 4px;">⚠️</i> Importante: Por razones de seguridad, se te solicitará cambiar esta contraseña temporal obligatoriamente en tu primer inicio de sesión.
            </p>
            
            <p style="margin: 0 0 24px 0;">La nueva contraseña deberá cumplir con políticas de seguridad avanzadas (mayúsculas, minúsculas, caracteres especiales y no contener secuencias ni patrones repetitivos).</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b;">
              <p style="margin: 0; font-size: 13px;">Saludos cordiales,</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: bold; color: #093641;">El Equipo de Proios Manager</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; color: #94a3b8; font-size: 11px;">
            © {timezone.now().year} Proios Manager. Todos los derechos reservados.<br>
            Este es un correo automático, por favor no lo respondas.
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    
    text_content = (
        f"Hola {user.first_name},\n\n"
        f"Tu cuenta en Proios Manager ha sido creada.\n"
        f"Usuario / DNI: {user.username}\n"
        f"Contraseña temporal: {user.username}\n\n"
        f"Ingresa aquí: {login_url}\n\n"
        f"Deberás cambiar tu contraseña en tu primer ingreso.\n"
    )
    
    try:
        # Registrar el mensaje en el historial del Correo Central como enviado (outbound)
        # y despacharlo usando la cola central de envío
        email_msg = EmailMessage.objects.create(
            message_id=f"OUT-{uuid.uuid4()}",
            subject=subject,
            sender_address='demomailproios@gmail.com', # Casilla central configurada
            sender_name="Proios Manager",
            recipient_address=user.email,
            date_received=timezone.now(),
            body_text=text_content,
            body_html=html_content,
            direction='outbound',
            is_read=True
        )
        send_outlook_email.delay(email_msg.id)
        return True
    except Exception as e:
        logger.error(f"Error al encolar e-mail de bienvenida para {user.email}: {e}")
        return False

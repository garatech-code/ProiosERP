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
    # La funcionalidad de enviar correos ha sido eliminada por pedido del cliente.
    return True

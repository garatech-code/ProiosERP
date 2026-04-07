from django.core.exceptions import PermissionDenied
from .models import Operacion, Ship, Port
from apps.usuarios.models import User
import re
import logging
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from django.utils import timezone

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Servicio de operaciones (lógica de negocio)
# ----------------------------------------------------------------------
class OperacionService:
    """
    Capa de Servicios para la lógica de negocio de Operaciones.
    Centraliza la Máquina de Estados y el control de transiciones basado en Roles.
    """

    @staticmethod
    def _verificar_y_forzar_borrador(operacion: Operacion, usuario: User) -> bool:
        """
        Interpreta si el cambio propuesto por el usuario requiere pasar por aprobación.
        Retorna True si debe quedar PENDIENTE DE APROBACIÓN, False si viaja directo al estado.
        """
        if usuario.role == User.Role.OWNER:
            return False
            
        if usuario.role in [User.Role.OPERADOR, User.Role.CONTABLE]:
            if usuario.requires_owner_review:
                return True
            return False

        # Los operarios no pueden modificar estados operativos, eleva error de seguridad. 
        raise PermissionDenied("Los operarios de planta no pueden alterar el ciclo de vida documental.")

    @staticmethod
    def procesar_presupuesto(operacion: Operacion, usuario: User):
        """Intenta lanzar la operacion a Presupuestada"""
        if OperacionService._verificar_y_forzar_borrador(operacion, usuario):
            operacion.estado = Operacion.ESTADO_PENDIENTE_APROBACION
        else:
            operacion.presupuestar()
        
        operacion.save()
        # Aquí se emitirá el evento Celery en el futuro

    @staticmethod
    def iniciar_produccion(operacion: Operacion, usuario: User):
        if OperacionService._verificar_y_forzar_borrador(operacion, usuario):
            operacion.estado = Operacion.ESTADO_PENDIENTE_APROBACION
        else:
            operacion.iniciar_produccion()
        operacion.save()

    @staticmethod
    def aprobar_cambios_por_owner(operacion: Operacion, nuevo_estado: str, owner: User):
        """
        Método exclusivo para el Owner: Fuerza la transición de un borrador hacia adelante.
        """
        if owner.role != User.Role.OWNER:
            raise PermissionDenied("Solo el Owner puede aprobar transiciones bloqueadas.")

        if operacion.estado != Operacion.ESTADO_PENDIENTE_APROBACION:
            raise ValueError("La operación no está pendiente de aprobación.")

        # Bypass de FSM estricto mediante override forzado del estado aprobado por el Owner
        operacion.estado = nuevo_estado
        operacion.save()


# ----------------------------------------------------------------------
# Servicios de scraping y autocompletado por IMO
# ----------------------------------------------------------------------
def scrape_vessel_info(imo):
    """
    Extrae nombre, bandera, destino (puerto) y ETA de VesselFinder.
    Retorna un dict con los datos o None si hay error.
    """
    url = f"https://www.vesselfinder.com/es/vessels/details/{imo}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Error scraping IMO {imo}: {e}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text()
    
    # Nombre
    nombre = None
    h1 = soup.find("h1")
    if h1:
        nombre = h1.get_text(strip=True)
    
    # Bandera
    bandera = None
    dt_flag = soup.find("dt", string=re.compile(r"Bandera|Flag", re.IGNORECASE))
    if dt_flag:
        dd = dt_flag.find_next_sibling("dd")
        if dd:
            bandera = dd.get_text(strip=True)
    if not bandera:
        for td in soup.find_all("td", string=re.compile(r"Flag", re.IGNORECASE)):
            next_td = td.find_next_sibling("td")
            if next_td:
                bandera = next_td.get_text(strip=True)
                break
    if not bandera:
        match_flag = re.search(r"(?:Flag|Bandera)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", text, re.IGNORECASE)
        if match_flag:
            bandera = match_flag.group(1).strip()
    
    # Destino (puerto)
    destino = None
    match_dest = re.search(r"Destination\s*\n\s*([^\n]+)", text, re.IGNORECASE)
    if not match_dest:
        match_dest = re.search(r"Destino\s*\n\s*([^\n]+)", text, re.IGNORECASE)
    if match_dest:
        destino = match_dest.group(1).strip()
        if "not available" in destino.lower():
            destino = None
    
    # ETA: obtener string y convertirlo a ISO 8601 (para datetime-local)
    eta_str = None
    eta_iso = None
    # Buscar patrón "ETA: Apr 8, 14:00" o similar
    match_eta = re.search(r"ETA:\s*([A-Za-z]+\.?\s+\d{1,2},\s+\d{2}:\d{2})", text)
    if match_eta:
        eta_str = match_eta.group(1).strip()
    else:
        match_eta2 = re.search(r"ETA:\s*([^(\n]+)", text)
        if match_eta2:
            eta_candidate = match_eta2.group(1).strip()
            eta_str = re.sub(r"\s*\(.*?\)", "", eta_candidate).strip()
    
    if eta_str:
        logger.info(f"ETA raw para IMO {imo}: {eta_str}")
        # Limpiar: eliminar puntos
        eta_clean = eta_str.replace('.', '').strip()
        now = timezone.now()
        # El formato típico es "Apr 8, 14:00" -> falta el año
        # Insertamos el año después del día y antes de la hora
        if ',' in eta_clean and not re.search(r'\d{4}', eta_clean):
            parts = eta_clean.split(',')
            if len(parts) == 2:
                day_part = parts[0].strip()      # "Apr 8"
                time_part = parts[1].strip()     # "14:00"
                eta_clean = f"{day_part}, {now.year} {time_part}"
                logger.info(f"ETA con año insertado: {eta_clean}")
        
        # Probar formatos (el orden importa)
        for fmt in ["%b %d, %Y %H:%M", "%B %d, %Y %H:%M", "%b %d, %H:%M", "%B %d, %H:%M"]:
            try:
                dt = datetime.strptime(eta_clean, fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=now.year)
                eta_iso = timezone.make_aware(dt).isoformat()
                logger.info(f"ETA parseado exitosamente: {eta_iso}")
                break
            except ValueError as e:
                logger.debug(f"Formato {fmt} falló: {e}")
                continue
        if not eta_iso:
            logger.warning(f"No se pudo parsear ETA para {imo}: {eta_str}")
    
    return {
        "imo": imo,
        "nombre": nombre,
        "bandera": bandera,
        "destino": destino,
        "eta": eta_iso,
        "eta_raw": eta_str,
    }


def get_or_create_ship_from_imo(imo):
    """Busca o crea un Ship usando el IMO, y opcionalmente actualiza nombre/bandera desde scraping."""
    try:
        ship = Ship.objects.get(imo=imo)
    except Ship.DoesNotExist:
        ship = None
    
    data = scrape_vessel_info(imo)
    if data:
        defaults = {
            'name': data['nombre'] or f"Buque {imo}",
            'flag': data['bandera'] or 'Desconocida',
        }
        ship, created = Ship.objects.update_or_create(
            imo=imo,
            defaults=defaults
        )
        return ship, data
    else:
        if not ship:
            ship = Ship.objects.create(
                imo=imo,
                name=f"Buque {imo}",
                flag="Desconocida"
            )
        return ship, None


def get_or_create_port_from_name(port_name):
    """Busca o crea un Puerto por nombre, con país por defecto 'Desconocido'."""
    if not port_name:
        return None
    port, _ = Port.objects.get_or_create(
        name=port_name.strip(),
        defaults={'country': 'Desconocido'}
    )
    return port
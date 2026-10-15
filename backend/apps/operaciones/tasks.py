import logging
import uuid
import re
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from celery import shared_task

from apps.operaciones.models import Operacion
from apps.correos.models import EmailMessage
from apps.correos.tasks import send_outlook_email

logger = logging.getLogger(__name__)


def generar_cuerpo_alerta_html(operacion, horas_transcurridas):
    """
    Genera el HTML corporativo para la alerta de inactividad de 24 horas enviada a Eva Proios.
    """
    buque_nombre = operacion.ship.name if operacion.ship else "No especificado"
    buque_bandera = operacion.ship.flag if (operacion.ship and operacion.ship.flag) else "N/A"
    buque_imo = operacion.ship.imo if (operacion.ship and operacion.ship.imo) else "N/A"
    cliente_nombre = operacion.cliente.name if operacion.cliente else "No especificado"
    puerto_nombre = operacion.port.name if operacion.port else "No especificado"
    
    operadores = operacion.operadores_asignados.all()
    if operadores.exists():
        operadores_texto = ", ".join([f"{u.first_name} {u.last_name}".strip() or u.username for u in operadores])
    elif operacion.creado_por:
        operadores_texto = f"{operacion.creado_por.first_name} {operacion.creado_por.last_name}".strip() or operacion.creado_por.username
    else:
        operadores_texto = "Sin operador asignado"

    creado_por_texto = "N/A"
    if operacion.creado_por:
        creado_por_texto = f"{operacion.creado_por.first_name} {operacion.creado_por.last_name}".strip() or operacion.creado_por.username

    fecha_inicio_str = operacion.fecha_inicio_control_operador.strftime('%d/%m/%Y a las %H:%M') if operacion.fecha_inicio_control_operador else operacion.fecha_creacion.strftime('%d/%m/%Y a las %H:%M')
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://proios.com').rstrip('/')
    op_url = f"{frontend_url}/operations/{operacion.id}"

    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Alerta de Inactividad Operativa</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Encabezado con Alerta -->
    <div style="background-color: #dc2626; color: #ffffff; padding: 20px 24px; text-align: left;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
        ⚠️ Alerta: 24hs Sin Avances en Operación
      </h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">
        Control automático de plazos operativos — Proios Manager
      </p>
    </div>

    <!-- Contenido Principal -->
    <div style="padding: 24px;">
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin-top: 0;">
        Estimada <strong>Eva</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Se ha detectado que la operación <strong>OP-{operacion.id:05d}</strong> ha cumplido más de <strong>24 horas</strong> ({horas_transcurridas} hs) desde su creación o asignación de operador y <strong>aún no presenta avances</strong> en su flujo operativo (sin cotización enviada ni cambio de fase).
      </p>

      <!-- Ficha de la Operación -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; background-color: #f1f5f9; border-radius: 12px; overflow: hidden;">
        <tbody>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #e2e8f0;">Operación:</td>
            <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">OP-{operacion.id:05d} ({operacion.get_tipo_operacion_display()})</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Buque:</td>
            <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{buque_nombre} (IMO: {buque_imo} / {buque_bandera})</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Cliente:</td>
            <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{cliente_nombre}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Puerto:</td>
            <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{puerto_nombre}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Operador(es) a cargo:</td>
            <td style="padding: 10px 14px; font-weight: bold; color: #1e40af; border-bottom: 1px solid #e2e8f0;">{operadores_texto}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Creada por:</td>
            <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{creado_por_texto}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Inicio del Plazo:</td>
            <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{fecha_inicio_str}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; font-weight: bold; color: #475569;">Estado Actual:</td>
            <td style="padding: 10px 14px; font-weight: bold; color: #b45309;">{operacion.get_estado_display()} (Fase Inicial)</td>
          </tr>
        </tbody>
      </table>

      <!-- Botón de acceso -->
      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="{op_url}" target="_blank" style="background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 24px; border-radius: 8px; display: inline-block;">
          Ver Operación en Proios Manager →
        </a>
      </div>
      
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 12px;">
        Este es un mensaje automático generado por el sistema de control operativo de Proios S.A.
      </p>

      <!-- Firma Institucional -->
      <br>
      <table style="font-family: 'Times New Roman', serif; color: #000; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="text-align: center; vertical-align: middle; border-right: 1px solid #000; padding-right: 16px;">
            <img src="cid:logo" alt="PROIOS S.A." style="width: 140px; display: block; margin: 0 auto;">
          </td>
          <td style="vertical-align: middle; padding-left: 16px; font-size: 10pt; line-height: 1.4;">
            <p style="margin: 0; font-weight: bold;">Proios S.A. Operations</p>
            <p style="margin: 0;">Comodoro Pedro Zanni 351 floor 5th 503 LN.</p>
            <p style="margin: 0;">Buenos Aires (C1104AAH) Argentina</p>
            <p style="margin: 0;">Email: <a href="mailto:operations@proios.com" style="color: #000; text-decoration: underline;">operations@proios.com</a></p>
            <p style="margin: 0;"><a href="http://www.proios.com" style="color: #0056b3; text-decoration: underline; text-transform: uppercase;">WWW.PROIOS.COM</a></p>
          </td>
        </tr>
      </table>

    </div>
  </div>
</body>
</html>
"""
    return html


def enviar_alerta_inactividad_eva(operacion):
    """
    Envía el correo de alerta a eva@proios.com desde operations@proios.com.
    """
    from apps.correos.models import EmailMessage
    from apps.correos.tasks import send_outlook_email

    sender_email = getattr(settings, 'MS_GRAPH_USER_EMAIL', 'operations@proios.com')
    destinatario = 'eva@proios.com'
    
    # Calcular horas
    if operacion.fecha_inicio_control_operador:
        delta = timezone.now() - operacion.fecha_inicio_control_operador
        horas = round(delta.total_seconds() / 3600, 1)
    else:
        horas = 24.0

    buque_str = operacion.ship.name if operacion.ship else "Buque s/n"
    cliente_str = operacion.cliente.name if operacion.cliente else "Cliente s/n"
    asunto = f"[ALERTA INACTIVIDAD 24H] OP-{operacion.id:05d} sin avances - {buque_str} ({cliente_str})"

    cuerpo_html = generar_cuerpo_alerta_html(operacion, horas)
    cuerpo_texto = (
        f"ALERTA: La operación OP-{operacion.id:05d} ({buque_str}) lleva más de 24 horas ({horas} hs) sin avances.\n"
        f"Cliente: {cliente_str}\n"
        f"Fecha inicio: {operacion.fecha_inicio_control_operador or operacion.fecha_creacion}\n\n"
        f"Ver operación en: {getattr(settings, 'FRONTEND_URL', 'https://proios.com')}/operations/{operacion.id}"
    )

    email_msg = EmailMessage.objects.create(
        message_id=f"OUT-ALERT-{uuid.uuid4()}",
        subject=asunto,
        sender_address=sender_email,
        sender_name="Proios SA - Control Operativo",
        recipient_address=destinatario,
        date_received=timezone.now(),
        body_text=cuerpo_texto,
        body_html=cuerpo_html,
        direction='outbound',
        is_read=True,
        operacion=operacion
    )

    # Disparar envío a través de Celery (con fallback eager)
    send_outlook_email.delay(email_msg.id)
    logger.info(f"Correo de alerta encolado (ID {email_msg.id}) para OP-{operacion.id} hacia {destinatario}")
    return email_msg


@shared_task
def verificar_inactividad_operaciones_24h():
    """
    Tarea periódica que revisa operaciones que lleven más de 24 horas sin avances
    desde la creación o asignación del operador.
    """
    limite_24h = timezone.now() - timedelta(hours=24)
    
    # Operaciones no cerradas, no canceladas, no ocultas
    candidatas = Operacion.objects.filter(
        oculta=False,
        alerta_inactividad_24h_enviada=False
    ).exclude(
        estado__in=[Operacion.ESTADO_ENTREGADA, Operacion.ESTADO_CANCELADA]
    ).select_related('cliente', 'ship', 'port', 'creado_por').prefetch_related('operadores_asignados')

    notificadas = 0

    for op in candidatas:
        # Si no tiene fecha_inicio_control_operador, verificar si tiene operadores asignados o creador operador
        fecha_control = op.fecha_inicio_control_operador
        if not fecha_control:
            tiene_operadores = op.operadores_asignados.exists()
            creador_operador = op.creado_por and getattr(op.creado_por, 'role', None) == 'OPERADOR'
            if tiene_operadores or creador_operador:
                fecha_control = op.fecha_creacion
                op.fecha_inicio_control_operador = fecha_control
                op.save(update_fields=['fecha_inicio_control_operador'])
            else:
                continue

        # Verificar si pasaron más de 24 horas
        if fecha_control > limite_24h:
            continue

        # Verificar si presenta avances
        if not op.presenta_avances:
            try:
                enviar_alerta_inactividad_eva(op)
                op.alerta_inactividad_24h_enviada = True
                op.fecha_alerta_inactividad_24h = timezone.now()
                op.save(update_fields=['alerta_inactividad_24h_enviada', 'fecha_alerta_inactividad_24h'])
                notificadas += 1
                logger.info(f"Notificación de 24h enviada a Eva Proios para OP-{op.id}")
            except Exception as e:
                logger.exception(f"Error enviando alerta de inactividad para OP-{op.id}: {e}")

    return f"Verificación completada: {notificadas} operaciones alertadas a eva@proios.com."

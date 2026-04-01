from celery import shared_task
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from .models import Event, Operation
import logging
import time

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def process_event_task(self, event_id):
    """
    Tarea idempotente de ejemplo que procesa un evento del Transactional Outbox.
    Implementa retries y exponential backoff (vía param de decorator).
    """
    try:
        with transaction.atomic():
            # Intentar obtener evento y marcar como procesando con lock
            event = Event.objects.select_for_update().get(id=event_id, status='PENDING')
            event.status = 'PROCESSING'
            event.save()
            
        # Simular tarea pesada de procesamiento externo
        time.sleep(1)
        logger.info(f"Processing event: {event.type} -> {event.payload}")
        
        # Marcar como completado
        with transaction.atomic():
            event.status = 'PROCESSED'
            event.save()
            
        return f"Event {event_id} processed successfully."
        
    except Event.DoesNotExist:
        # Ya fue procesado o no existe (idempotencia)
        logger.warning(f"Event {event_id} not found or already processed.")
        return "Idempotent skip."
        
    except Exception as exc:
        logger.error(f"Error processing event {event_id}: {exc}")
        # Marcar fallido y reintentar
        with transaction.atomic():
            Event.objects.filter(id=event_id).update(status='FAILED')
            
        # Exponential backoff retry
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

@shared_task
def poll_pending_events():
    """
    Proceso background que busca eventos PENDING en el Outbox y los envía a Celery.
    Este proceso de polling asegura la Event Consistency (VERY IMPORTANT).
    """
    # Tomar los últimos 100 eventos pendientes (evitar saturación)
    pending_events = Event.objects.filter(status='PENDING')[:100]
    
    for event in pending_events:
        process_event_task.delay(event.id)

@shared_task
def check_eta_reminders():
    """Envía notificaciones para operaciones con ETA en las próximas 24h."""
    now = timezone.now()
    soon = now + timedelta(days=1)
    upcoming = Operation.objects.filter(eta__gte=now, eta__lte=soon, status__in=['confirmed', 'in_coordination'])
    for op in upcoming:
        # Aquí podrías enviar un email, guardar en base de datos, etc.
        # Por ahora solo imprimir
        print(f"Recordatorio: Operación {op.id} - Buque {op.ship.name} ETA {op.eta}")
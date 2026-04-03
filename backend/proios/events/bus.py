import logging
from typing import Dict, Type, Any

logger = logging.getLogger(__name__)

class Event:
    """Clase base para todos los eventos del dominio"""
    
    @property
    def event_name(self) -> str:
        return self.__class__.__name__

    def to_dict(self) -> Dict[str, Any]:
        """Serializa el evento para ser empacado en Celery"""
        return self.__dict__

class EventBus:
    """
    Enrutador central de eventos de Dominio.
    Desacopla a los Publishers de los Handlers asíncronos (Celery)
    """
    def __init__(self):
        self._handlers = {}

    def register(self, event_class: Type[Event], celery_task):
        """Registra una tarea de Celery como handler de un evento"""
        event_name = event_class.__name__
        if event_name not in self._handlers:
            self._handlers[event_name] = []
        self._handlers[event_name].append(celery_task)
        logger.info(f"Handler {celery_task.name} registrado para evento {event_name}")

    def publish(self, event: Event):
        """Dispara los handlers a través de Celery para el evento dado"""
        event_name = event.event_name
        handlers = self._handlers.get(event_name, [])
        
        if not handlers:
            logger.warning(f"Se emitió {event_name} pero no hay handlers registrados.")
            return

        payload = event.to_dict()
        for task in handlers:
            # Encolar la tarea asíncronamente
            task.delay(**payload)
            logger.info(f"Evento {event_name} encolado a handler {task.name}. Payload: {payload}")

# Singleton global del Bus
event_bus = EventBus()

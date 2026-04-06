from django.core.exceptions import PermissionDenied
from .models import Operacion
from apps.usuarios.models import User

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

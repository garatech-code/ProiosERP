import ipaddress
from rest_framework import permissions

class IsLocalIP(permissions.BasePermission):
    """
    Permite acceso solo si la IP proviene de una red local o privada (ej. 192.168.x.x, 10.x.x.x, 127.0.0.1)
    """
    def has_permission(self, request, view):
        ip_str = request.META.get('HTTP_X_FORWARDED_FOR')
        if ip_str:
            ip_str = ip_str.split(',')[0].strip()
        else:
            ip_str = request.META.get('REMOTE_ADDR')
            
        if not ip_str:
            return False
            
        try:
            ip = ipaddress.ip_address(ip_str)
            return ip.is_private or ip.is_loopback
        except ValueError:
            return False

class IsAdminUser(permissions.BasePermission):
    """
    Permite el acceso solo a usuarios con rol ADMIN.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == request.user.Role.OWNER)

class IsManagerOrAdmin(permissions.BasePermission):
    """
    Permite acceso a Gerentes (Managers) o Admins
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == request.user.Role.OWNER)

class RestrictedPasswordPermission(permissions.BasePermission):
    """
    Bloquea accesos si el usuario debe cambiar su contraseña,
    excepto para la acción de cambiar contraseña.
    """
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated:
            if getattr(user, 'must_change_password', False):
                if request.path.endswith('/change_password/'):
                    return True
                return False
        return True

class IsOwnerOrCreatorSenior(permissions.BasePermission):
    """
    Permite acceso de modificación (PUT, PATCH, DELETE, POST que modifican) solo si el usuario es OWNER
    o es el OPERADOR (Senior) que creó la operación.
    """
    def has_object_permission(self, request, view, obj):
        # Lecturas seguras permitidas
        if request.method in permissions.SAFE_METHODS:
            return True

        # descargar_zip y generar reportes son POST pero de solo lectura/generación
        if view.action in ['descargar_zip', 'generate_cotizacion_pdf', 'generate_solicitud_particular_pdf']:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        # OWNER puede hacer cualquier modificación
        if user.role in ['OWNER', 'CONTABLE']:
            return True

        # OPERADOR y OPERADOR_JR pueden modificar si son creadores o están asignados
        if user.role in ['OPERADOR', 'OPERADOR_JR']:
            return obj.creado_por == user or obj.operadores_asignados.filter(id=user.id).exists()

        return False


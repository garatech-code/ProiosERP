from rest_framework import permissions

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

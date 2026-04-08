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

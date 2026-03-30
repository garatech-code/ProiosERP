from rest_framework import permissions

class BaseRolePermission(permissions.BasePermission):
    """
    Clase base para permisos basados en roles.
    """
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == request.user.Role.ADMIN:
            return True # Admins tienen siempre acceso
        return request.user.role in self.allowed_roles

    def has_object_permission(self, request, view, obj):
        # Por defecto, si tiene permiso general, tiene sobre el objeto.
        # Puede sobrescribirse en hijos.
        return self.has_permission(request, view)

class IsAdminUser(BaseRolePermission):
    allowed_roles = [] # Solo ADMIN cubierto por BaseRolePermission

class IsManagerOrAdmin(BaseRolePermission):
    allowed_roles = ['MANAGER']

class IsOperator(BaseRolePermission):
    allowed_roles = ['MANAGER', 'OPERATOR']

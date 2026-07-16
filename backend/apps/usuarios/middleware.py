import os
from django.http import JsonResponse
from django.conf import settings

class MaintenanceModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.flag_path = os.path.join(settings.BASE_DIR, 'maintenance.flag')

    def __call__(self, request):
        if os.path.exists(self.flag_path):
            # Ignorar rutas específicas como el login o el toggle_maintenance
            if not request.path.startswith('/api/core/auth/') and not request.path.startswith('/api/usuarios/users/toggle_maintenance/') and not request.path.startswith('/admin/'):
                return JsonResponse({'detail': 'maintenance'}, status=503)
        return self.get_response(request)

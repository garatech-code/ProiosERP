from django.contrib import admin
from .models import Operacion, Client, Ship, Port, Agency, OperacionDetalle

class OperacionAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'ship', 'estado', 'eta')
    list_filter = ('estado', 'delivery_method')
    search_fields = ('cliente__name', 'ship__name')
    filter_horizontal = ('operadores_asignados', 'contables_asignados', 'operarios_asignados')

admin.site.register(Operacion, OperacionAdmin)
admin.site.register(Client)
admin.site.register(Ship)
admin.site.register(Port)
admin.site.register(Agency)
admin.site.register(OperacionDetalle)

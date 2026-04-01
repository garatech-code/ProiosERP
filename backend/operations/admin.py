from django.contrib import admin
from .models import Client, Ship, Port, Product, Agency, Operation, OperationProduct

admin.site.register(Client)
admin.site.register(Ship)
admin.site.register(Port)
admin.site.register(Product)
admin.site.register(Agency)
admin.site.register(Operation)
admin.site.register(OperationProduct)
from django.db import models
from django.conf import settings
from django_fsm import FSMField, transition
from django.utils import timezone

class Client(models.Model):
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    price_list = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Ship(models.Model):
    name = models.CharField(max_length=200)
    imo = models.CharField(max_length=7, unique=True)
    flag = models.CharField(max_length=50)
    call_sign = models.CharField(max_length=20, blank=True)
    gross_tonnage = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} (IMO: {self.imo})"

class Port(models.Model):
    name = models.CharField(max_length=200)
    country = models.CharField(max_length=100)
    code = models.CharField(max_length=10, blank=True)

    def __str__(self):
        return self.name

class Agency(models.Model):
    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)
    email = models.EmailField()

    def __str__(self):
        return self.name

class Operacion(models.Model):
    ESTADO_SOLICITADA = 'solicitada'
    ESTADO_PENDIENTE_APROBACION = 'pendiente_aprobacion'
    ESTADO_PRESUPUESTADA = 'presupuestada'
    ESTADO_EN_PRODUCCION = 'en_produccion'
    ESTADO_LISTA_PARA_ENVIO = 'lista_para_envio'
    ESTADO_REMITADA = 'remitada'
    ESTADO_ENTREGADA = 'entregada'
    ESTADO_CANCELADA = 'cancelada'

    ESTADOS_CHOICES = (
        (ESTADO_SOLICITADA, 'Solicitada'),
        (ESTADO_PENDIENTE_APROBACION, 'Pendiente de Aprobación (Borrador)'),
        (ESTADO_PRESUPUESTADA, 'Presupuestada / Confirmada'),
        (ESTADO_EN_PRODUCCION, 'En Producción / En Coordinación'),
        (ESTADO_LISTA_PARA_ENVIO, 'Lista para Envío'),
        (ESTADO_REMITADA, 'Remitada'),
        (ESTADO_ENTREGADA, 'Entregada'),
        (ESTADO_CANCELADA, 'Cancelada'),
    )

    cliente = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="operaciones")
    ship = models.ForeignKey(Ship, on_delete=models.PROTECT)
    port = models.ForeignKey(Port, on_delete=models.PROTECT)
    agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True)
    eta = models.DateTimeField(null=True, blank=True)
    
    delivery_method = models.CharField(max_length=20, choices=[('muelle', 'Muelle'), ('lancha', 'Lancha')], default='muelle')
    notas = models.TextField(blank=True)
    
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    # Campo protegido por FSM
    estado = FSMField(default=ESTADO_SOLICITADA, choices=ESTADOS_CHOICES, protected=True)

    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='operaciones_creadas')
    
    # Asignaciones designadas por el Owner (RBAC a nivel Objeto)
    operadores_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_asignadas', blank=True)
    contables_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_contables', blank=True)
    operarios_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_operario', blank=True)

    class Meta:
        verbose_name = "Operación"
        verbose_name_plural = "Operaciones"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"OP-{self.pk:05d} : {self.cliente} ({self.get_estado_display()})"

    @transition(field=estado, source=ESTADO_SOLICITADA, target=ESTADO_PRESUPUESTADA)
    def presupuestar(self):
        pass

    @transition(field=estado, source=ESTADO_PRESUPUESTADA, target=ESTADO_EN_PRODUCCION)
    def iniciar_produccion(self):
        pass

    @transition(field=estado, source=ESTADO_EN_PRODUCCION, target=ESTADO_LISTA_PARA_ENVIO)
    def finalizar_produccion(self):
        pass

    @transition(field=estado, source=[ESTADO_EN_PRODUCCION, ESTADO_LISTA_PARA_ENVIO], target=ESTADO_REMITADA)
    def remitar(self):
        pass

    @transition(field=estado, source=ESTADO_REMITADA, target=ESTADO_ENTREGADA)
    def entregar(self):
        pass

    @transition(field=estado, source='*', target=ESTADO_CANCELADA)
    def cancelar(self):
        pass
class OperacionDetalle(models.Model):
    operacion = models.ForeignKey(Operacion, on_delete=models.CASCADE, related_name='detalles')
    articulo_id = models.IntegerField() # Lax FK to inventario.Articulo
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    def __str__(self): return f'Detalle OP-{self.operacion_id} Art-{self.articulo_id}'

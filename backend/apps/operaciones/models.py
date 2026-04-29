from django.db import models
from django.conf import settings
from django_fsm import FSMField, transition
from django.utils import timezone
from django.core.exceptions import ValidationError


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
    # NUEVOS ESTADOS FSM (SEGUN NUEVA ARQUITECTURA)
    ESTADO_SOLICITADA = 'solicitada' # O "Delivery Note Generado"
    ESTADO_ARMADO_PACKING = 'armado_packing' # Operador contacta proveedores y gestiona el pedido
    ESTADO_EN_ADUANA = 'en_aduana' # Lista enviada a aduana, se espera rancho
    ESTADO_LISTA_PARA_ENVIO = 'lista_para_envio' # Rancho OK, listo para coordinar/generar remito
    ESTADO_REMITADA = 'remitada' # Entregada / Firma
    ESTADO_ENTREGADA = 'entregada' # Cerrada
    ESTADO_CANCELADA = 'cancelada'

    ESTADOS_CHOICES = (
        (ESTADO_SOLICITADA, 'Generada / Pendiente Packing'),
        (ESTADO_ARMADO_PACKING, 'En Gestión (Armado del Packing List)'),
        (ESTADO_EN_ADUANA, 'En Aduana (Esperando Rancho)'),
        (ESTADO_LISTA_PARA_ENVIO, 'Logística (Despacho y Remito)'),
        (ESTADO_REMITADA, 'Entregada en sitio'),
        (ESTADO_ENTREGADA, 'Completada / Cerrada'),
        (ESTADO_CANCELADA, 'Cancelada'),
    )

    cliente = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="operaciones")
    ship = models.ForeignKey(Ship, on_delete=models.PROTECT)
    port = models.ForeignKey(Port, on_delete=models.PROTECT)
    agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True)
    eta = models.DateTimeField(null=True, blank=True)

    delivery_method = models.CharField(max_length=20, choices=[('muelle', 'Muelle'), ('lancha', 'Lancha')], default='muelle')
    notas = models.TextField(blank=True)
    
    # Campo crucial para pegar el "Delivery Note" / E-mail original del cliente
    texto_pedido = models.TextField(blank=True, null=True, help_text="Contenido original del e-mail o pedido del cliente.")
    
    # Nombre identificatorio para la operación (visible en cards y detail)
    nombre = models.CharField(max_length=200, blank=True, null=True, help_text="Nombre identificatorio de la operación")

    # NUEVOS CAMPOS SOLICITADOS POR EL FRONTEND
    order_received_date = models.DateTimeField(null=True, blank=True)
    client_confirmed_date = models.DateTimeField(null=True, blank=True)
    delivery_date = models.DateTimeField(null=True, blank=True)
    closed_date = models.DateTimeField(null=True, blank=True)

    TIPO_PRODUCTOS = 'productos'
    TIPO_QUIMICOS = 'quimicos'
    TIPO_SERVICIOS = 'servicios'
    TIPO_CHOICES = (
        (TIPO_PRODUCTOS, 'Productos'),
        (TIPO_QUIMICOS, 'Químicos'),
        (TIPO_SERVICIOS, 'Servicios'),
    )
    tipo_operacion = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_PRODUCTOS)
    aprobacion_requerida_owner = models.BooleanField(default=False)

    # CAMPOS ESPECÍFICOS DE SERVICIOS
    TIPO_COTIZACION_HORA_HOMBRE = 'hora_hombre'
    TIPO_COTIZACION_DIAS = 'dias'
    TIPO_COTIZACION_LUMPSUM = 'lumpsum'
    COTIZACION_CHOICES = (
        (TIPO_COTIZACION_HORA_HOMBRE, 'Hora Hombre'),
        (TIPO_COTIZACION_DIAS, 'Días'),
        (TIPO_COTIZACION_LUMPSUM, 'Lumpsum (Suma Global)'),
    )
    detalle_servicio = models.TextField(blank=True, null=True, help_text="Descripción detallada para operaciones de tipo Servicio.")
    forma_cotizacion_servicio = models.CharField(max_length=20, choices=COTIZACION_CHOICES, blank=True, null=True)

    # ARCHIVOS
    packing_list_file = models.FileField(upload_to='packing_lists/', null=True, blank=True)
    remito_file = models.FileField(upload_to='remitos/', null=True, blank=True)
    rancho_file = models.FileField(upload_to='ranchos/', null=True, blank=True)
    stock_consumido = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    # CAMPOS DE REVISIÓN (Workflow de Aprobación Admin-Operador)
    ESTADO_REVISION_NONE = 'none'
    ESTADO_REVISION_PENDING = 'pending'
    ESTADO_REVISION_APPROVED = 'approved'
    ESTADO_REVISION_REJECTED = 'rejected'
    REVISION_CHOICES = (
        (ESTADO_REVISION_NONE, 'Ninguna'),
        (ESTADO_REVISION_PENDING, 'Pendiente de Revisión'),
        (ESTADO_REVISION_APPROVED, 'Aprobada'),
        (ESTADO_REVISION_REJECTED, 'Rechazada'),
    )
    estado_revision = models.CharField(max_length=20, choices=REVISION_CHOICES, default=ESTADO_REVISION_NONE)
    mensaje_revision = models.TextField(blank=True, null=True, help_text="Comentarios del operador (al solicitar) o del owner (al aprobar/rechazar).")

    estado = FSMField(default=ESTADO_SOLICITADA, choices=ESTADOS_CHOICES, protected=True)

    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='operaciones_creadas')

    operadores_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_asignadas', blank=True)
    contables_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_contables', blank=True)
    operarios_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_operario', blank=True)

    class Meta:
        verbose_name = "Operación"
        verbose_name_plural = "Operaciones"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"OP-{self.pk:05d} : {self.cliente} ({self.get_estado_display()})"

    # Transiciones FSM que coinciden con las acciones del frontend
    # Transiciones FSM que coinciden con las acciones del frontend
    @transition(field=estado, source=ESTADO_SOLICITADA, target=ESTADO_ARMADO_PACKING)
    def start_packing(self):
        """Iniciar gestión de proveedores y armado de Packing List"""
        pass

    @transition(field=estado, source=ESTADO_ARMADO_PACKING, target=ESTADO_EN_ADUANA)
    def send_to_customs(self):
        """Avanzar a etapa de aduana (requiere subir el packing list)"""
        # Nota: El avance a aduana consume virtualmente el stock para separarlo
        ok, errores = self.verificar_stock()
        if not ok:
            raise ValidationError(f"Stock o productos insuficientes/incorrectos para proceder a Aduana: {errores}")
        self.consumir_stock()
        self.client_confirmed_date = timezone.now()

    @transition(field=estado, source=ESTADO_EN_ADUANA, target=ESTADO_LISTA_PARA_ENVIO)
    def finalize_customs(self):
        """Aduana entrega el Rancho. Listo para logística."""
        pass

    @transition(field=estado, source=ESTADO_LISTA_PARA_ENVIO, target=ESTADO_REMITADA)
    def mark_delivered(self):
        """Se ha gestionado la logística y se ha emitido el remito"""
        self.delivery_date = timezone.now()
        pass

    @transition(field=estado, source=ESTADO_REMITADA, target=ESTADO_ENTREGADA)
    def close(self):
        """Cerrar operación y archivada"""
        self.closed_date = timezone.now()
        pass

    @transition(field=estado, source='*', target=ESTADO_CANCELADA)
    def cancel(self):
        """Cancelar operación"""
        pass

    def verificar_stock(self):
        """
        Verifica si hay stock suficiente para todos los detalles de la operación.
        Retorna: (bool, list) - (todo_ok, lista_de_errores)
        """
        from apps.inventario.models import Articulo
        
        errores = []
        for detalle in self.detalles.all():
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                if articulo.stock_actual < detalle.cantidad:
                    errores.append({
                        'articulo_id': detalle.articulo_id,
                        'nombre': articulo.nombre,
                        'disponible': float(articulo.stock_actual),
                        'necesario': float(detalle.cantidad)
                    })
            except Articulo.DoesNotExist:
                errores.append({
                    'articulo_id': detalle.articulo_id,
                    'error': f'Artículo ID {detalle.articulo_id} no existe en inventario'
                })
        
        return len(errores) == 0, errores

    def consumir_stock(self):
        """
        Consume el stock de todos los artículos de la operación.
        Debe llamarse dentro de una transacción atómica.
        """
        from apps.inventario.models import Articulo, MovimientoStock
        
        if self.stock_consumido:
            raise ValueError("El stock de esta operación ya fue consumido")
        
        ok, errores = self.verificar_stock()
        if not ok:
            raise ValueError(f"Stock insuficiente: {errores}")
        
        for detalle in self.detalles.all():
            articulo = Articulo.objects.select_for_update().get(id=detalle.articulo_id)
            
            # Crear movimiento de salida
            MovimientoStock.objects.create(
                articulo=articulo,
                tipo='SALIDA',
                cantidad=detalle.cantidad,
                stock_resultante=articulo.stock_actual - detalle.cantidad,
                operacion_id=self.id,
                razon=f"Consumo por operación {self.id} - {self.cliente.name}"
            )
            
            # Actualizar stock
            articulo.stock_actual -= detalle.cantidad
            articulo.save()
        
        self.stock_consumido = True
        self.save(update_fields=['stock_consumido'])


class OperacionDetalle(models.Model):
    operacion = models.ForeignKey(Operacion, on_delete=models.CASCADE, related_name='detalles')
    articulo_id = models.IntegerField()  # Lax FK to inventario.Articulo
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f'Detalle OP-{self.operacion_id} Art-{self.articulo_id}'


class AgendaEvent(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_events')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.assigned_to})"
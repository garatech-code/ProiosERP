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
    imo = models.CharField(max_length=7, blank=True, null=True)
    flag = models.CharField(max_length=50, blank=True, null=True)
    call_sign = models.CharField(max_length=20, blank=True)
    gross_tonnage = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} (IMO: {self.imo or 'N/A'})"


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
    # Estados FSM (Productos / Químicos)
    ESTADO_RECIBIDA = 'recibida'
    ESTADO_COTIZACION_ENVIADA = 'cotizacion_enviada'
    ESTADO_SOLICITADA = 'solicitada'
    ESTADO_ARMADO_PACKING = 'armado_packing'
    ESTADO_EN_ADUANA = 'en_aduana'
    ESTADO_LISTA_PARA_ENVIO = 'lista_para_envio'
    ESTADO_REMITADA = 'remitada'
    
    # Estados FSM específicos (Servicios)
    ESTADO_SOLICITUD_SERVICIO = 'solicitud_servicio'
    ESTADO_COTIZADO = 'cotizado'
    ESTADO_PERMISOS_PNA = 'permisos_pna'
    ESTADO_EN_EJECUCION = 'en_ejecucion'
    ESTADO_REPORTE_FIRMADO = 'reporte_firmado'

    # Estados Comunes
    ESTADO_ENTREGADA = 'entregada'
    ESTADO_CANCELADA = 'cancelada'
    ESTADO_PAUSADA = 'pausada'

    ESTADOS_CHOICES = (
        (ESTADO_RECIBIDA, 'Recibida'),
        (ESTADO_COTIZACION_ENVIADA, 'Cotización Enviada'),
        (ESTADO_SOLICITADA, 'Preparación'),
        (ESTADO_ARMADO_PACKING, 'En Gestión (Armado del Packing List)'),
        (ESTADO_EN_ADUANA, 'En Aduana (Esperando Rancho)'),
        (ESTADO_LISTA_PARA_ENVIO, 'Logística (Despacho y Remito)'),
        (ESTADO_REMITADA, 'Entregada en sitio'),
        
        (ESTADO_SOLICITUD_SERVICIO, 'Solicitud de Servicio'),
        (ESTADO_COTIZADO, 'Servicio Cotizado'),
        (ESTADO_PERMISOS_PNA, 'Permisos PNA Gestionados'),
        (ESTADO_EN_EJECUCION, 'En Ejecución'),
        (ESTADO_REPORTE_FIRMADO, 'Reporte Firmado / Finalizado'),

        (ESTADO_ENTREGADA, 'Completada / Cerrada'),
        (ESTADO_CANCELADA, 'Cancelada'),
        (ESTADO_PAUSADA, 'Pausada (Rechazada / En Revisión)'),
    )

    cliente = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="operaciones")
    ship = models.ForeignKey(Ship, on_delete=models.PROTECT)
    port = models.ForeignKey(Port, on_delete=models.PROTECT)
    agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True)
    eta = models.DateTimeField(null=True, blank=True)

    delivery_method = models.CharField(max_length=20, choices=[('muelle', 'Muelle'), ('lancha', 'Lancha')], default='muelle')
    notas = models.TextField(blank=True)

    texto_pedido = models.TextField(blank=True, null=True, help_text="Contenido original del e-mail o pedido del cliente.")
    nombre = models.CharField(max_length=200, blank=True, null=True, help_text="Nombre identificatorio de la operación")

    order_received_date = models.DateTimeField(null=True, blank=True)
    quotation_sent_date = models.DateTimeField(null=True, blank=True)
    quoted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='quoted_operations')
    client_confirmed_date = models.DateTimeField(null=True, blank=True)
    delivery_date = models.DateTimeField(null=True, blank=True)
    closed_date = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_operations')
    dificil_conseguir = models.BooleanField(default=False, help_text="Excluye a esta operación de las alertas de tiempo de cotización")
    motivo_rechazo = models.TextField(blank=True, null=True, help_text="Razón por la que se rechazó la cotización o se pausó la operación")

    TIPO_PRODUCTOS = 'productos'
    TIPO_QUIMICOS = 'quimicos'
    TIPO_SERVICIOS = 'servicios'
    TIPO_OTROS = 'otros'
    TIPO_CHOICES = (
        (TIPO_PRODUCTOS, 'Productos'),
        (TIPO_QUIMICOS, 'Químicos'),
        (TIPO_SERVICIOS, 'Servicios'),
        (TIPO_OTROS, 'Otros'),
    )
    tipo_operacion = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_PRODUCTOS)
    aprobacion_requerida_owner = models.BooleanField(default=False)

    TIPO_COTIZACION_HORA_HOMBRE = 'hora_hombre'
    TIPO_COTIZACION_DIAS = 'dias'
    TIPO_COTIZACION_LUMPSUM = 'lumpsum'
    COTIZACION_CHOICES = (
        (TIPO_COTIZACION_HORA_HOMBRE, 'Hora Hombre'),
        (TIPO_COTIZACION_DIAS, 'Días'),
        (TIPO_COTIZACION_LUMPSUM, 'Lumpsum (Suma Global)'),
    )
    detalle_servicio = models.TextField(blank=True, null=True, help_text="Descripción detallada para operaciones de tipo Servicio.")
    valor_servicio = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Valor monetario del trabajo a realizar")
    subtipo_servicio = models.CharField(max_length=100, blank=True, null=True, help_text="Categoría específica del servicio (Mecanica, Electricidad, etc.)")
    forma_cotizacion_servicio = models.CharField(max_length=20, choices=COTIZACION_CHOICES, blank=True, null=True)
    herramientas_solicitud_particular = models.TextField(blank=True, null=True, help_text="Listado de herramientas a subir/bajar para la Solicitud Particular.")
    texto_permiso_pna = models.TextField(blank=True, null=True, help_text="Texto personalizado para el PDF de Permiso PNA.")
    texto_cotizacion_adicional = models.TextField(blank=True, null=True, help_text="Texto adicional o condiciones para la Cotización.")

    packing_list_file = models.FileField(upload_to='packing_lists/', null=True, blank=True)
    remito_file = models.FileField(upload_to='remitos/', null=True, blank=True)
    rancho_file = models.FileField(upload_to='ranchos/', null=True, blank=True)
    solicitud_particular_file = models.FileField(upload_to='solicitud_particular/', null=True, blank=True)
    factura_file = models.FileField(upload_to='facturas/', null=True, blank=True)
    stock_consumido = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

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

    estado = FSMField(default=ESTADO_RECIBIDA, choices=ESTADOS_CHOICES, protected=True)

    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='operaciones_creadas')

    operadores_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_asignadas', blank=True)
    contables_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_contables', blank=True)
    plantel_asignado = models.JSONField(default=list, blank=True, help_text="Snapshot estático de los operarios asignados")
    operarios_usuarios_asignados = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='operaciones_como_operario', blank=True)
    operarios_asignados = models.ManyToManyField('usuarios.PersonalPlantel', related_name='operaciones_como_plantel', blank=True)

    class Meta:
        verbose_name = "Operación"
        verbose_name_plural = "Operaciones"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"OP-{self.pk:05d} : {self.cliente} ({self.get_estado_display()})"

    @transition(field=estado, source=[ESTADO_RECIBIDA, ESTADO_COTIZACION_ENVIADA, ESTADO_PAUSADA], target=ESTADO_COTIZACION_ENVIADA)
    def cotizar_producto(self):
        self.quotation_sent_date = timezone.now()

    @transition(field=estado, source=ESTADO_COTIZACION_ENVIADA, target=ESTADO_SOLICITADA)
    def cliente_confirma_producto(self):
        self.client_confirmed_date = timezone.now()

    @transition(field=estado, source=ESTADO_SOLICITADA, target=ESTADO_ARMADO_PACKING)
    def start_packing(self):
        pass

    @transition(field=estado, source=ESTADO_ARMADO_PACKING, target=ESTADO_EN_ADUANA)
    def send_to_customs(self):
        ok, errores = self.verificar_stock()
        if not ok:
            raise ValidationError(f"Stock o productos insuficientes/incorrectos para proceder a Aduana: {errores}")
        self.consumir_stock()
        self.client_confirmed_date = timezone.now()

    @transition(field=estado, source=ESTADO_EN_ADUANA, target=ESTADO_LISTA_PARA_ENVIO)
    def finalize_customs(self):
        pass

    @transition(field=estado, source=ESTADO_LISTA_PARA_ENVIO, target=ESTADO_REMITADA)
    def mark_delivered(self):
        self.delivery_date = timezone.now()
        pass

    @transition(field=estado, source=ESTADO_REMITADA, target=ESTADO_ENTREGADA)
    def close(self):
        self.closed_date = timezone.now()
        pass

    # Transiciones para Servicios
    @transition(field=estado, source=[ESTADO_RECIBIDA, ESTADO_SOLICITUD_SERVICIO, ESTADO_SOLICITADA, ESTADO_COTIZADO, ESTADO_PAUSADA], target=ESTADO_COTIZADO)
    def cotizar_servicio(self):
        self.client_confirmed_date = timezone.now()

    @transition(field=estado, source=ESTADO_COTIZADO, target=ESTADO_PERMISOS_PNA)
    def tramitar_permisos_pna(self):
        pass

    @transition(field=estado, source=ESTADO_PERMISOS_PNA, target=ESTADO_EN_EJECUCION)
    def iniciar_ejecucion_servicio(self):
        pass

    @transition(field=estado, source=ESTADO_EN_EJECUCION, target=ESTADO_REPORTE_FIRMADO)
    def finalizar_servicio_reporte(self):
        self.delivery_date = timezone.now()

    @transition(field=estado, source=ESTADO_REPORTE_FIRMADO, target=ESTADO_ENTREGADA)
    def close_servicio(self):
        self.closed_date = timezone.now()

    @transition(field=estado, source=[ESTADO_COTIZACION_ENVIADA, ESTADO_COTIZADO], target=ESTADO_PAUSADA)
    def rechazar_cotizacion(self):
        pass

    @transition(field=estado, source=ESTADO_PAUSADA, target=ESTADO_RECIBIDA)
    def reanudar_operacion(self):
        pass

    @transition(field=estado, source=ESTADO_PAUSADA, target=ESTADO_RECIBIDA)
    def recotizar(self):
        self.quotation_sent_date = None
        self.client_confirmed_date = None
        pass

    @transition(field=estado, source='*', target=ESTADO_CANCELADA)
    def cancel(self):
        self.restituir_stock()

    def restituir_stock(self):
        from apps.inventario.models import Articulo, MovimientoStock
        if not self.stock_consumido:
            return
        for detalle in self.detalles.all():
            try:
                articulo = Articulo.objects.select_for_update().get(id=detalle.articulo_id)
                if not articulo.controlar_stock:
                    continue
                MovimientoStock.objects.create(
                    articulo=articulo,
                    tipo='INGRESO',
                    cantidad=detalle.cantidad,
                    stock_resultante=articulo.stock_actual + detalle.cantidad,
                    operacion_id=self.id,
                    razon=f"Devolución de stock por cancelación de operación {self.id}"
                )
                articulo.stock_actual += detalle.cantidad
                articulo.save()
            except Articulo.DoesNotExist:
                pass
        self.stock_consumido = False
        self.save(update_fields=['stock_consumido'])


    def verificar_stock(self):
        from apps.inventario.models import Articulo
        errores = []
        for detalle in self.detalles.all():
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                if not articulo.controlar_stock:
                    continue
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
        from apps.inventario.models import Articulo, MovimientoStock
        if self.stock_consumido:
            raise ValueError("El stock de esta operación ya fue consumido")
        ok, errores = self.verificar_stock()
        if not ok:
            raise ValueError(f"Stock insuficiente: {errores}")
        for detalle in self.detalles.all():
            try:
                articulo = Articulo.objects.select_for_update().get(id=detalle.articulo_id)
                if not articulo.controlar_stock:
                    continue
                MovimientoStock.objects.create(
                    articulo=articulo,
                    tipo='SALIDA',
                    cantidad=detalle.cantidad,
                    stock_resultante=articulo.stock_actual - detalle.cantidad,
                    operacion_id=self.id,
                    razon=f"Consumo por operación {self.id} - {self.cliente.name}"
                )
                articulo.stock_actual -= detalle.cantidad
                articulo.save()
            except Articulo.DoesNotExist:
                pass
        self.stock_consumido = True
        self.save(update_fields=['stock_consumido'])


class OperacionDetalle(models.Model):
    operacion = models.ForeignKey(Operacion, on_delete=models.CASCADE, related_name='detalles')
    articulo_id = models.IntegerField()
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


class DocumentoAdjunto(models.Model):
    TIPO_DELIVERY_NOTE = 'delivery_note'
    TIPO_FACTURA_PROVEEDOR = 'factura_proveedor'
    TIPO_HABILITACION_ADUANERA = 'habilitacion_aduanera'
    
    # Documentos específicos de Servicios
    TIPO_COTIZACION_SERVICIO = 'cotizacion_servicio'
    TIPO_PERMISO_PNA = 'permiso_pna'
    TIPO_SOLICITUD_PARTICULAR = 'solicitud_particular'
    TIPO_REPORTE_SERVICIO = 'reporte_servicio'
    
    TIPO_OTROS = 'otros'

    TIPO_CHOICES = (
        (TIPO_DELIVERY_NOTE, 'Preparación'),
        (TIPO_FACTURA_PROVEEDOR, 'Factura a proveedor'),
        (TIPO_HABILITACION_ADUANERA, 'Habilitación aduanera'),
        
        (TIPO_COTIZACION_SERVICIO, 'Cotización de Servicio'),
        (TIPO_PERMISO_PNA, 'Permiso PNA'),
        (TIPO_SOLICITUD_PARTICULAR, 'Solicitud Particular'),
        (TIPO_REPORTE_SERVICIO, 'Reporte de Servicio'),
        
        (TIPO_OTROS, 'Otros'),
    )

    operacion = models.ForeignKey(Operacion, on_delete=models.CASCADE, related_name='documentos_adjuntos')
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    nombre_personalizado = models.CharField(max_length=200, blank=True, null=True, help_text="Usar si tipo es 'Otros'")
    archivo = models.FileField(upload_to='operaciones/documentos/')
    descripcion = models.TextField(blank=True, null=True)
    fecha_subida = models.DateTimeField(auto_now_add=True)
    subido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        if self.tipo == self.TIPO_OTROS:
            return f"{self.nombre_personalizado or 'Otro'} - OP{self.operacion.id}"
        return f"{self.get_tipo_display()} - OP{self.operacion.id}"
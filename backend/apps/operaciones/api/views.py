from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
import io
import logging

from apps.operaciones.models import Operacion, Client, Ship, Port, Agency
from apps.usuarios.models import User
from apps.operaciones.services import get_or_create_ship_from_imo, get_or_create_port_from_name

from .serializers import (
    OperacionSerializer, ClientSerializer, ShipSerializer,
    PortSerializer, AgencySerializer, OperacionDetalleSerializer
)

logger = logging.getLogger(__name__)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer


class ShipViewSet(viewsets.ModelViewSet):
    queryset = Ship.objects.all()
    serializer_class = ShipSerializer


class PortViewSet(viewsets.ModelViewSet):
    queryset = Port.objects.all()
    serializer_class = PortSerializer


class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all()
    serializer_class = AgencySerializer


class OperacionViewSet(viewsets.ModelViewSet):
    serializer_class = OperacionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Operacion.objects.all().select_related('cliente', 'ship', 'port', 'agency').prefetch_related('detalles')

        if user.role in [User.Role.OWNER, User.Role.CONTABLE]:
            return qs

        return qs.filter(
            Q(operadores_asignados=user) |
            Q(operarios_asignados=user) |
            Q(contables_asignados=user)
        ).distinct()

    @action(detail=False, methods=['get'])
    def dashboard_metrics(self, request):
        user = request.user
        if user.role not in [User.Role.OWNER, User.Role.CONTABLE]:
            return Response({'error': 'No autorizado'}, status=403)

        qs = Operacion.objects.all()

        total = qs.count()
        en_proceso = qs.exclude(estado__in=[
            Operacion.ESTADO_ENTREGADA,
            Operacion.ESTADO_CANCELADA
        ]).count()
        finalizadas = qs.filter(estado=Operacion.ESTADO_ENTREGADA).count()
        usuarios_activos = User.objects.filter(is_active=True).count()

        return Response({
            'total': total,
            'en_proceso': en_proceso,
            'finalizadas': finalizadas,
            'usuarios_activos': usuarios_activos
        })

    @action(detail=False, methods=['get'])
    def holidays_ar(self, request):
        try:
            import holidays
            year = timezone.now().year
            ar_holidays = holidays.AR(years=[year, year+1])
            data = [{"date": str(date), "name": name} for date, name in ar_holidays.items()]
            return Response(data)
        except ImportError:
            return Response({'error': 'Librería holidays no instalada'}, status=500)

    @action(detail=True, methods=['post'])
    def cancel_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.cancel()
            op.save()
            return Response({'status': 'cancelled'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def confirm_operation(self, request, pk=None):
        """
        Pasa de Delivery Note Generado a Armado de Packing List.
        """
        operacion = self.get_object()

        if operacion.estado != Operacion.ESTADO_SOLICITADA:
            return Response(
                {'error': f'La operación no está en estado inicial. Estado actual: {operacion.estado}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            try:
                operacion.start_packing()
                operacion.save()
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': f'Error inesperado: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = self.get_serializer(operacion)
        return Response({
            'status': 'confirmed',
            'operation': serializer.data,
            'message': 'Operación confirmada y stock consumido correctamente'
        })

    @action(detail=True, methods=['post'])
    def start_coordination(self, request, pk=None):
        """
        Envía a aduanas y pasa a estado EN_ADUANA.
        """
        op = self.get_object()
        # Verificar que se haya subido un packing list
        if not op.packing_list_file:
            return Response({'error': 'Debe subir el Packing List estructurado antes de enviar a Aduanas'}, status=400)

        with transaction.atomic():
            try:
                op.send_to_customs()
                op.save()
                return Response({'status': 'in_customs'})
            except ValidationError as e:
                return Response({'error': str(e)}, status=400)
            except Exception as e:
                return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def finalize_production(self, request, pk=None):
        """
        Aduana completada (Rancho fue subido). Pasa a LISTA_PARA_ENVIO.
        """
        op = self.get_object()
        if not op.rancho_file:
            return Response({'error': 'Debe subir el Documento Rancho antes de aprobar aduanas'}, status=400)
            
        with transaction.atomic():
            try:
                op.finalize_customs()
                op.save()
                return Response({'status': 'ready_for_delivery'})
            except ValidationError as e:
                return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        op = self.get_object()
        try:
            op.mark_delivered()
            op.save()
            return Response({'status': 'delivered'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def close_operation(self, request, pk=None):
        op = self.get_object()
        try:
            op.close()
            op.save()
            return Response({'status': 'closed'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='upload_packing')
    def upload_packing(self, request, pk=None):
        op = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        op.packing_list_file = request.FILES['file']
        op.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='upload_remito')
    def upload_remito(self, request, pk=None):
        op = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        op.remito_file = request.FILES['file']
        op.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='upload_rancho')
    def upload_rancho(self, request, pk=None):
        op = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        op.rancho_file = request.FILES['file']
        op.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['get'], url_path='packing_list_json')
    def packing_list_json(self, request, pk=None):
        op = self.get_object()
        from apps.inventario.models import Articulo
        productos = []
        total_price = 0
        total_weight = 0
        for detalle in op.detalles.all():
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                subtotal = detalle.cantidad * float(detalle.precio_unitario)
                total_price += subtotal
                unit_weight = float(articulo.peso_kg)
                total_weight += detalle.cantidad * unit_weight
                productos.append({
                    'name': articulo.nombre,
                    'quantity': detalle.cantidad,
                    'presentation': articulo.presentacion,
                    'unit_weight': unit_weight,
                    'total_weight': detalle.cantidad * unit_weight,
                    'unit_price': float(detalle.precio_unitario),
                    'subtotal': subtotal,
                })
            except Articulo.DoesNotExist:
                productos.append({
                    'name': f"Artículo ID {detalle.articulo_id} (no existe)",
                    'quantity': detalle.cantidad,
                    'presentation': '',
                    'unit_weight': 0,
                    'total_weight': 0,
                    'unit_price': float(detalle.precio_unitario),
                    'subtotal': detalle.cantidad * float(detalle.precio_unitario),
                })
        data = {
            'operation_id': op.id,
            'client': op.cliente.name,
            'ship': op.ship.name,
            'port': op.port.name,
            'eta': op.eta,
            'products': productos,
            'total_price': total_price,
            'total_weight': total_weight,
        }
        return Response(data)

    @action(detail=True, methods=['get'])
    def verificar_stock(self, request, pk=None):
        operacion = self.get_object()
        ok, errores = operacion.verificar_stock()

        detalles_data = []
        for detalle in operacion.detalles.all():
            from apps.inventario.models import Articulo
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                detalles_data.append({
                    'id': detalle.id,
                    'articulo_id': detalle.articulo_id,
                    'nombre': articulo.nombre,
                    'presentacion': articulo.presentacion,
                    'cantidad_necesaria': detalle.cantidad,
                    'stock_actual': float(articulo.stock_actual),
                    'suficiente': articulo.stock_actual >= detalle.cantidad,
                    'error': None
                })
            except Articulo.DoesNotExist:
                detalles_data.append({
                    'id': detalle.id,
                    'articulo_id': detalle.articulo_id,
                    'nombre': f"ID {detalle.articulo_id}",
                    'presentacion': "",
                    'cantidad_necesaria': detalle.cantidad,
                    'stock_actual': 0,
                    'suficiente': False,
                    'error': "Producto no existe en inventario"
                })

        return Response({
            'operacion_id': operacion.id,
            'todo_suficiente': ok,
            'detalles': detalles_data,
            'errores': errores
        })

    @action(detail=False, methods=['get'], url_path='auto_complete_imo')
    def auto_complete_imo(self, request):
        imo = request.query_params.get('imo')

        if not imo or not imo.isdigit() or len(imo) != 7:
            return Response({"error": "Se requiere un IMO válido de 7 dígitos"}, status=400)

        ship, scraped_data = get_or_create_ship_from_imo(imo)

        if not scraped_data:
            return Response({"error": "No se pudo obtener información del buque."}, status=404)

        port = None
        port_id = None
        port_name = scraped_data.get('destino')

        if port_name:
            port = get_or_create_port_from_name(port_name)
            port_id = port.id if port else None

        return Response({
            "ship_id": ship.id,
            "ship_name": ship.name,
            "flag": ship.flag,
            "imo": ship.imo,
            "eta": scraped_data.get('eta'),
            "eta_raw": scraped_data.get('eta_raw'),
            "port_id": port_id,
            "port_name": port_name,
        })

    @action(detail=True, methods=['get'], url_path='packing_list_excel')
    def packing_list_excel(self, request, pk=None):
        """
        Genera un archivo Excel con el formato de Packing List solicitado.
        Acepta parámetros GET: ?proveedor=...&pais_destino=...
        """
        try:
            op = self.get_object()
            from apps.inventario.models import Articulo

            # Leer parámetros de la solicitud
            proveedor_seleccionado = request.query_params.get('proveedor', '')
            pais_destino_seleccionado = request.query_params.get('pais_destino', 'argentina')  # 'argentina' o 'bandera'

            # Determinar el país de destino
            if pais_destino_seleccionado == 'argentina':
                pais_destino_texto = 'Argentina'
            else:
                # Usar la bandera del buque si está disponible, sino 'Extranjero'
                pais_destino_texto = op.ship.flag if op.ship and op.ship.flag else 'Extranjero'

            # Determinar el proveedor y su CUIT
            if proveedor_seleccionado == 'PROIOS SA':
                proveedor_texto = 'PROIOS SA'
                cuit_texto = '30-63661723-3'
            elif proveedor_seleccionado == 'PROIOS SALVAGE SA':
                proveedor_texto = 'PROIOS SALVAGE SA'
                cuit_texto = '33-71087653-9'
            else:
                proveedor_texto = ''
                cuit_texto = ''

            productos = []
            total_price = 0.0
            total_weight_neto = 0.0
            total_weight_bruto = 0.0
            total_qty = 0

            for detalle in op.detalles.all():
                try:
                    articulo = Articulo.objects.get(id=detalle.articulo_id)
                    cantidad = detalle.cantidad
                    precio = float(detalle.precio_unitario) if detalle.precio_unitario else 0.0
                    subtotal = cantidad * precio
                    total_price += subtotal
                    total_qty += cantidad
                    peso_neto = float(articulo.peso_kg) if articulo.peso_kg is not None else 0.0
                    peso_bruto = peso_neto * 1.1  # Ajustable
                    total_weight_neto += cantidad * peso_neto
                    total_weight_bruto += cantidad * peso_bruto
                    productos.append({
                        'descripcion': articulo.nombre,
                        'qty': cantidad,
                        'peso_neto': peso_neto,
                        'peso_bruto': peso_bruto,
                        'un_vta': articulo.presentacion or 'Kg',
                        'fob_unitario': precio,
                        'fob_total': subtotal,
                    })
                except Articulo.DoesNotExist:
                    logger.warning(f"Artículo {detalle.articulo_id} no existe en operación {op.id}")
                    continue

            wb = Workbook()
            ws = wb.active
            ws.title = "PACKING LIST"

            # Estilos
            header_font = Font(bold=True, name='Arial')
            center_align = Alignment(horizontal='center', vertical='center')
            thin_border = Border(
                left=Side(style='thin'), right=Side(style='thin'),
                top=Side(style='thin'), bottom=Side(style='thin')
            )
            green_fill = PatternFill(start_color="92D050", end_color="92D050", fill_type="solid")
            orange_fill = PatternFill(start_color="FFC000", end_color="FFC000", fill_type="solid")
            gray_header_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

            # Encabezado (usando los valores seleccionados)
            encabezados = [
                ("PROVEEDOR:", proveedor_texto),
                ("CUIT:", cuit_texto),
                ("PAÍS DE DESTINO DE LA FACTURA:", pais_destino_texto),
                ("BANDERA:", op.ship.flag if op.ship else ""),
                ("EMPRESA A FACTURAR:", op.cliente.name if op.cliente else ""),
                ("BUQUE:", op.ship.name if op.ship else "")
            ]
            row = 1
            for label, value in encabezados:
                ws.cell(row=row, column=1, value=label).font = header_font
                ws.cell(row=row, column=2, value=value)
                row += 1

            # Fila "ITEMS" verde
            row += 1
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=7)
            items_cell = ws.cell(row=row, column=1, value="ITEMS")
            items_cell.font = Font(bold=True, size=12)
            items_cell.alignment = center_align
            items_cell.fill = green_fill

            # Encabezados de tabla
            headers = ["DESCRIPCION", "QTY", "PESO NETO", "PESO BRUTO", "UN. VTA", "FOB UNITARIO", "FOB TOTAL"]
            row += 1
            for col, header in enumerate(headers, start=1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.font = header_font
                cell.alignment = center_align
                cell.fill = gray_header_fill

            # Datos
            for prod in productos:
                row += 1
                ws.cell(row=row, column=1, value=prod['descripcion'])
                ws.cell(row=row, column=2, value=prod['qty'])
                ws.cell(row=row, column=3, value=round(prod['peso_neto'], 2))
                ws.cell(row=row, column=4, value=round(prod['peso_bruto'], 2))
                ws.cell(row=row, column=5, value=prod['un_vta'])
                ws.cell(row=row, column=6, value=round(prod['fob_unitario'], 2))
                ws.cell(row=row, column=7, value=round(prod['fob_total'], 2))

            # Fila de totales naranja
            row += 1
            ws.cell(row=row, column=1, value="TOTALES").font = Font(bold=True)
            ws.cell(row=row, column=2, value=total_qty)
            ws.cell(row=row, column=3, value=round(total_weight_neto, 2))
            ws.cell(row=row, column=4, value=round(total_weight_bruto, 2))
            ws.cell(row=row, column=5, value="")
            ws.cell(row=row, column=6, value=f"USD {round(total_price, 2)}")
            ws.cell(row=row, column=7, value=f"USD {round(total_price, 2)}")

            for col in range(1, 8):
                ws.cell(row=row, column=col).fill = orange_fill
                ws.cell(row=row, column=col).alignment = center_align

            # Bordes
            for r in range(1, row+1):
                for c in range(1, 8):
                    ws.cell(row=r, column=c).border = thin_border

            # Anchos de columna
            column_widths = [40, 8, 12, 12, 10, 15, 15]
            for i, width in enumerate(column_widths, start=1):
                ws.column_dimensions[get_column_letter(i)].width = width

            output = io.BytesIO()
            wb.save(output)
            output.seek(0)

            response = HttpResponse(output, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="packing_list_{op.id}.xlsx"'
            return response

        except Exception as e:
            logger.exception("Error generando packing list Excel")
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=['post'])
    def request_review(self, request, pk=None):
        op = self.get_object()
        mensaje = request.data.get('mensaje_revision', '')
        
        op.estado_revision = Operacion.ESTADO_REVISION_PENDING
        op.aprobacion_requerida_owner = True
        if mensaje:
            op.mensaje_revision = mensaje
        op.save()
        return Response({'status': 'review_requested'})

    @action(detail=True, methods=['post'])
    def resolve_review(self, request, pk=None):
        op = self.get_object()
        user = request.user
        
        if user.role != User.Role.OWNER:
            return Response({'error': 'Solo el Owner puede resolver revisiones'}, status=403)
            
        action = request.data.get('action') # 'approve' or 'reject'
        mensaje = request.data.get('mensaje_revision', '')
        
        if action == 'approve':
            op.estado_revision = Operacion.ESTADO_REVISION_APPROVED
            op.aprobacion_requerida_owner = False
        elif action == 'reject':
            op.estado_revision = Operacion.ESTADO_REVISION_REJECTED
            op.aprobacion_requerida_owner = False
        else:
            return Response({'error': 'Acción inválida'}, status=400)
            
        if mensaje:
            op.mensaje_revision = mensaje
            
        op.save()
        return Response({'status': 'review_resolved', 'action': action})
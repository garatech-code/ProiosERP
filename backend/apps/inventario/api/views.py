from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.paginator import Paginator
from django.http import HttpResponse
from apps.inventario.models import Articulo, MovimientoStock, Proveedor, ProductoLog
from .serializers import ArticuloSerializer, MovimientoStockSerializer, ProveedorSerializer, ProductoLogSerializer
import pandas as pd
import re
import logging
from io import BytesIO
import csv

logger = logging.getLogger(__name__)


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filterset_fields = ['nombre', 'rubro']

    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
        """
        Carga masiva de proveedores desde un archivo Excel.
        Soporta .xlsx (openpyxl) y .xls (xlrd).
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        nombre_archivo = file.name.lower()
        if not (nombre_archivo.endswith('.xlsx') or nombre_archivo.endswith('.xls')):
            return Response({'error': 'Formato no soportado. Use .xlsx o .xls'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if nombre_archivo.endswith('.xlsx'):
                engine = 'openpyxl'
            else:
                try:
                    import xlrd
                    engine = 'xlrd'
                except ImportError:
                    return Response({'error': 'Para archivos .xls es necesario instalar la librería "xlrd". Ejecute: pip install xlrd'}, status=status.HTTP_400_BAD_REQUEST)
            df = pd.read_excel(file, engine=engine)
        except Exception as e:
            error_msg = str(e)
            if "zip file" in error_msg or "not a zip file" in error_msg:
                error_msg = "El archivo no es un Excel válido. Asegúrese de que la extensión coincida con el formato real."
            return Response({'error': f'Error al leer el archivo: {error_msg}'}, status=status.HTTP_400_BAD_REQUEST)

        df.columns = [str(col).strip().lower().replace(' ', '_') for col in df.columns]
        expected_columns = ['nombre', 'contacto', 'telefono', 'email', 'direccion', 'rubro', 'condicion_pago']
        missing = [col for col in expected_columns if col not in df.columns]
        if missing:
            return Response({'error': f'Faltan columnas obligatorias: {", ".join(missing)}'}, status=status.HTTP_400_BAD_REQUEST)

        CONDICIONES_VALIDAS = dict(Proveedor.CONDICION_PAGO_CHOICES).keys()
        creados = 0
        actualizados = 0
        errores = []

        with transaction.atomic():
            for idx, row in df.iterrows():
                nombre = str(row.get('nombre', '')).strip()
                if not nombre:
                    errores.append(f"Fila {idx+2}: 'nombre' es obligatorio")
                    continue

                contacto = str(row.get('contacto', '')).strip() if pd.notna(row.get('contacto')) else ''
                telefono = str(row.get('telefono', '')).strip() if pd.notna(row.get('telefono')) else ''
                email = str(row.get('email', '')).strip() if pd.notna(row.get('email')) else ''
                direccion = str(row.get('direccion', '')).strip() if pd.notna(row.get('direccion')) else ''
                rubro = str(row.get('rubro', '')).strip() if pd.notna(row.get('rubro')) else ''
                condicion_pago = str(row.get('condicion_pago', '')).strip() if pd.notna(row.get('condicion_pago')) else ''

                if condicion_pago and condicion_pago not in CONDICIONES_VALIDAS:
                    errores.append(f"Fila {idx+2}: condicion_pago '{condicion_pago}' no válida. Opciones: {', '.join(CONDICIONES_VALIDAS)}")
                    continue

                defaults = {
                    'contacto': contacto,
                    'telefono': telefono,
                    'email': email,
                    'direccion': direccion,
                    'rubro': rubro,
                }
                if condicion_pago:
                    defaults['condicion_pago'] = condicion_pago

                try:
                    proveedor, created = Proveedor.objects.update_or_create(nombre=nombre, defaults=defaults)
                    if created:
                        creados += 1
                    else:
                        actualizados += 1
                except Exception as e:
                    errores.append(f"Fila {idx+2}: error al guardar '{nombre}' - {str(e)}")

        return Response({
            'message': f'Procesado: {creados} creados, {actualizados} actualizados.',
            'creados': creados,
            'actualizados': actualizados,
            'errores': errores
        }, status=status.HTTP_200_OK if (creados + actualizados) > 0 else status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='template')
    def download_template(self, request):
        data = {
            'nombre': ['Proveedor Ejemplo S.A.', 'Otro Proveedor'],
            'contacto': ['Juan Pérez', 'María Gómez'],
            'telefono': ['123456789', '987654321'],
            'email': ['juan@proveedor.com', 'maria@otro.com'],
            'direccion': ['Calle Falsa 123', ''],
            'rubro': ['Industrial', 'Logística'],
            'condicion_pago': ['contado', '30_dias'],
        }
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Proveedores')
        output.seek(0)
        response = Response(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="plantilla_proveedores.xlsx"'
        return response


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ArticuloSerializer

    def get_queryset(self):
        queryset = Articulo.objects.all()
        categoria = self.request.query_params.get('categoria')
        if categoria:
            categorias = [c.strip() for c in categoria.split(',') if c.strip()]
            queryset = queryset.filter(categoria__in=categorias)
        # ✅ Agregar filtro por búsqueda
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(nombre__icontains=search)
        return queryset

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def perform_update(self, serializer):
        # Obtener la instancia anterior antes de guardar
        producto = self.get_object()
        old_stock = producto.stock_actual
        
        # Guardar el nuevo estado
        producto = serializer.save()
        
        # Si el stock actual cambió, crear un movimiento de ajuste
        if old_stock != producto.stock_actual:
            from apps.inventario.models import MovimientoStock
            diferencia = producto.stock_actual - old_stock
            MovimientoStock.objects.create(
                articulo=producto,
                tipo='AJUSTE',
                cantidad=abs(diferencia),
                stock_resultante=producto.stock_actual,
                razon=f'Ajuste manual de stock: {old_stock} → {producto.stock_actual}',
                usuario=self.request.user if self.request.user.is_authenticated else None
            )
        
        # Asignar usuario que modificó
        if self.request.user.is_authenticated:
            producto.modificado_por = self.request.user
            producto.save(update_fields=['modificado_por'])
        
        # Log de cambios (código existente)
        old_data = {
            'nombre': producto.nombre,
            'descripcion': producto.descripcion,
            'presentacion': producto.presentacion,
            'peso_kg': float(producto.peso_kg),
            'stock_actual': float(old_stock),  # usar el anterior
            'stock_minimo': float(producto.stock_minimo),
            'stock_maximo': float(producto.stock_maximo) if hasattr(producto, 'stock_maximo') else 0,
            'categoria': producto.categoria,
            'proveedor_id': producto.proveedor_id
        }
        new_data = {
            'nombre': producto.nombre,
            'descripcion': producto.descripcion,
            'presentacion': producto.presentacion,
            'peso_kg': float(producto.peso_kg),
            'stock_actual': float(producto.stock_actual),
            'stock_minimo': float(producto.stock_minimo),
            'stock_maximo': float(producto.stock_maximo) if hasattr(producto, 'stock_maximo') else 0,
            'categoria': producto.categoria,
            'proveedor_id': producto.proveedor_id
        }
        cambios = {}
        for key in old_data:
            if old_data[key] != new_data[key]:
                cambios[key] = {'old': old_data[key], 'new': new_data[key]}
        if cambios:
            from apps.inventario.models import ProductoLog
            ProductoLog.objects.create(
                producto=producto,
                accion='UPDATE',
                campos_modificados=cambios,
                usuario=self.request.user if self.request.user.is_authenticated else None,
                ip=self.get_client_ip(self.request)
            )

    def perform_destroy(self, instance):
        ProductoLog.objects.create(
            producto=instance,
            accion='DELETE',
            campos_modificados={'nombre': instance.nombre, 'id': instance.id},
            usuario=self.request.user if self.request.user.is_authenticated else None,
            ip=self.get_client_ip(self.request)
        )
        instance.delete()

    @action(detail=False, methods=['post'])
    def movimiento(self, request):
        serializer = MovimientoStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            # Obtener el artículo
            articulo_id = serializer.validated_data['articulo'].id
            articulo = Articulo.objects.select_for_update().get(id=articulo_id)
            cantidad = serializer.validated_data['cantidad']
            tipo = serializer.validated_data['tipo']
            
            # Calcular nuevo stock
            if tipo == 'INGRESO':
                nuevo_stock = articulo.stock_actual + cantidad
            elif tipo == 'SALIDA':
                if articulo.stock_actual < cantidad:
                    return Response(
                        {'error': f'Stock insuficiente. Disponible: {articulo.stock_actual}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                nuevo_stock = articulo.stock_actual - cantidad
            else:  # AJUSTE
                nuevo_stock = cantidad
            
            # Ahora crear el movimiento con stock_resultante ya calculado
            movimiento = MovimientoStock.objects.create(
                articulo=articulo,
                tipo=tipo,
                cantidad=cantidad,
                stock_resultante=nuevo_stock,
                operacion_id=serializer.validated_data.get('operacion_id'),
                razon=serializer.validated_data['razon'],
                usuario=request.user if request.user.is_authenticated else None
            )
            
            # Actualizar el stock del artículo
            articulo.stock_actual = nuevo_stock
            articulo.modificado_por = request.user if request.user.is_authenticated else None
            articulo.save()
        
        return Response(MovimientoStockSerializer(movimiento).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def disponibilidad(self, request):
        productos_ids = request.query_params.get('productos', '').split(',')
        cantidades = request.query_params.get('cantidades', '').split(',')
        
        if not productos_ids or not cantidades or len(productos_ids) != len(cantidades):
            return Response(
                {'error': 'Parámetros productos y cantidades deben tener la misma longitud'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        resultados = []
        for pid, cant_str in zip(productos_ids, cantidades):
            try:
                cantidad = float(cant_str)
                articulo = Articulo.objects.get(pk=pid)
                disponible = articulo.stock_actual >= cantidad
                resultados.append({
                    'producto_id': articulo.id,
                    'nombre': articulo.nombre,
                    'presentacion': articulo.presentacion,
                    'stock_actual': articulo.stock_actual,
                    'stock_minimo': articulo.stock_minimo,
                    'stock_maximo': getattr(articulo, 'stock_maximo', 0),
                    'cantidad_necesaria': cantidad,
                    'disponible': disponible
                })
            except Articulo.DoesNotExist:
                resultados.append({'producto_id': pid, 'error': 'Producto no existe'})
            except ValueError:
                resultados.append({'producto_id': pid, 'error': 'Cantidad inválida'})
        
        return Response(resultados)

    @action(detail=False, methods=['get'], url_path='movimientos')
    def listar_movimientos(self, request):
        from django.core.paginator import Paginator
        from django.http import HttpResponse
        import csv
        from io import BytesIO
        import pandas as pd

        queryset = MovimientoStock.objects.select_related('articulo', 'usuario').order_by('-fecha')
        
        # Filtros (igual que antes)
        articulo_id = request.query_params.get('articulo_id')
        if articulo_id:
            queryset = queryset.filter(articulo_id=articulo_id)
        
        tipo = request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        
        fecha_desde = request.query_params.get('fecha_desde')
        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)
        
        fecha_hasta = request.query_params.get('fecha_hasta')
        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)
        
        operacion_id = request.query_params.get('operacion_id')
        if operacion_id:
            queryset = queryset.filter(operacion_id=operacion_id)
        
        # Exportación
        export = request.query_params.get('export')
        if export in ['csv', 'excel']:
            data = []
            for mov in queryset:
                data.append({
                    'Fecha': mov.fecha.strftime('%Y-%m-%d %H:%M:%S'),
                    'Producto': mov.articulo.nombre,
                    'Usuario': mov.usuario.username if mov.usuario else 'Sistema',
                    'Tipo': mov.get_tipo_display(),
                    'Cantidad': float(mov.cantidad),
                    'Stock resultante': float(mov.stock_resultante),
                    'Operación ID': mov.operacion_id or '',
                    'Razón': mov.razon,
                })
            if export == 'csv':
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="movimientos_stock.csv"'
                writer = csv.DictWriter(response, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
                return response
            else:
                df = pd.DataFrame(data)
                output = BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name='Movimientos')
                output.seek(0)
                response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                response['Content-Disposition'] = 'attachment; filename="movimientos_stock.xlsx"'
                return response
        
        # Paginación
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        serializer = MovimientoStockSerializer(page_obj, many=True)
        return Response({
            'results': serializer.data,
            'total': paginator.count,
            'page': page,
            'page_size': page_size,
            'total_pages': paginator.num_pages
        })

    # ========== LOGS DE PRODUCTOS ==========
    @action(detail=False, methods=['get'], url_path='logs')
    def listar_logs(self, request):
        """
        Lista logs de cambios de productos.
        Parámetro: producto_id (opcional)
        """
        from .serializers import ProductoLogSerializer
        producto_id = request.query_params.get('producto_id')
        queryset = ProductoLog.objects.select_related('producto', 'usuario').order_by('-fecha')
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)
        serializer = ProductoLogSerializer(queryset[:200], many=True)
        return Response(serializer.data)
    def _export_movimientos(self, queryset, export_format):
        data = []
        for mov in queryset:
            data.append({
                'Fecha': mov.fecha.strftime('%Y-%m-%d %H:%M:%S'),
                'Producto': mov.articulo.nombre,
                'Tipo': mov.get_tipo_display(),
                'Cantidad': float(mov.cantidad),
                'Stock resultante': float(mov.stock_resultante),
                'Operación ID': mov.operacion_id or '',
                'Razón': mov.razon,
            })
        
        if not data:
            if export_format == 'csv':
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="movimientos_stock.csv"'
                response.write('No hay datos para exportar')
                return response
            else:
                response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                response['Content-Disposition'] = 'attachment; filename="movimientos_stock.xlsx"'
                return response
        
        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="movimientos_stock.csv"'
            writer = csv.DictWriter(response, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
            return response
        
        elif export_format == 'excel':
            df = pd.DataFrame(data)
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Movimientos')
            output.seek(0)
            response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = 'attachment; filename="movimientos_stock.xlsx"'
            return response

    # ========== LOGS DE PRODUCTOS ==========
    @action(detail=False, methods=['get'], url_path='logs')
    def listar_logs(self, request):
        producto_id = request.query_params.get('producto_id')
        queryset = ProductoLog.objects.select_related('producto', 'usuario')
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)
        serializer = ProductoLogSerializer(queryset[:200], many=True)
        return Response(serializer.data)

    # ========== FUNCIÓN AUXILIAR PARA ESTIMAR PESO (se mantiene igual) ==========
    def _estimar_peso_cadena(self, tipo_producto, calibre):
        calibre = float(calibre) if calibre else 0
        tipo = tipo_producto.lower()
        
        if 'cadena' in tipo:
            pesos_por_calibre = {89: 12.5, 78: 9.8, 42: 3.2, 38: 2.6, 25: 1.2, 127: 24.0, 112: 19.0, 98: 14.5, 92: 12.0}
            return pesos_por_calibre.get(calibre, 1.0)
        elif 'kenter' in tipo:
            pesos_por_calibre = {89: 8.2, 78: 6.0, 42: 1.8, 38: 1.4, 25: 0.7}
            return pesos_por_calibre.get(calibre, 1.0)
        elif 'grillete giratorio' in tipo:
            pesos_por_calibre = {89: 5.5, 78: 4.2, 98: 6.8, 42: 1.2, 38: 0.9, 25: 0.4}
            return pesos_por_calibre.get(calibre, 1.0)
        elif 'grillete' in tipo:
            pesos_por_calibre = {127: 12.0, 112: 9.5, 98: 7.2, 92: 6.0, 89: 5.0, 78: 3.8}
            return pesos_por_calibre.get(calibre, 1.0)
        else:
            return 1.0

    # ========== CARGA DE EXCEL (UPLOAD) ==========
    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        nombre_archivo = file.name.lower()
        if not (nombre_archivo.endswith('.xlsx') or nombre_archivo.endswith('.xls')):
            return Response({'error': 'Formato de archivo no soportado. Use .xlsx o .xls'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            engine = 'openpyxl' if nombre_archivo.endswith('.xlsx') else 'xlrd'
            df = pd.read_excel(file, header=None, dtype=str, engine=engine)
        except Exception as e:
            logger.error(f"Error al leer Excel: {e}")
            return Response({'error': f'Error al leer el archivo: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Detectar formato (cadenas, anclas, insumos, quimicos, generic_two_column)
        header_row_idx = None
        detected_format = None
        column_mapping = {}

        for idx, row in df.iterrows():
            row_lower = [str(cell).lower().strip() for cell in row if pd.notna(cell)]
            if any('productos' in cell for cell in row_lower) and any('calibre' in cell for cell in row_lower):
                header_row_idx = idx
                detected_format = 'cadenas'
                for col_idx, val in enumerate(row):
                    if pd.notna(val):
                        val_low = str(val).lower().strip()
                        if 'productos' in val_low:
                            column_mapping['producto'] = col_idx
                        elif 'calibre' in val_low:
                            column_mapping['calibre'] = col_idx
                        elif 'cantidad' in val_low:
                            column_mapping['cantidad'] = col_idx
                        elif 'set' in val_low:
                            column_mapping['set'] = col_idx
                break
            if any('kg' in cell for cell in row_lower) or any('num serie' in cell for cell in row_lower):
                header_row_idx = idx
                detected_format = 'anclas'
                for col_idx, val in enumerate(row):
                    if pd.notna(val):
                        val_low = str(val).lower().strip()
                        if 'kg' == val_low:
                            column_mapping['kg'] = col_idx
                        elif 'num serie' in val_low or 'numero' in val_low:
                            column_mapping['serie'] = col_idx
                        elif 'numero' == val_low:
                            column_mapping['numero'] = col_idx
                break
            if any('nombre' in cell for cell in row_lower) and any('cantidad' in cell for cell in row_lower):
                header_row_idx = idx
                detected_format = 'insumos'
                for col_idx, val in enumerate(row):
                    if pd.notna(val):
                        val_low = str(val).lower().strip()
                        if 'nombre' in val_low:
                            column_mapping['nombre'] = col_idx
                        elif 'cantidad' in val_low:
                            column_mapping['cantidad'] = col_idx
                        elif 'estado' in val_low:
                            column_mapping['estado'] = col_idx
                        elif 'observaciones' in val_low:
                            column_mapping['observaciones'] = col_idx
                        elif 'ubicación' in val_low:
                            column_mapping['ubicacion'] = col_idx
                break
            if any('producto' in cell for cell in row_lower) and any('cantidad' in cell for cell in row_lower):
                header_row_idx = idx
                detected_format = 'quimicos'
                for col_idx, val in enumerate(row):
                    if pd.notna(val):
                        val_low = str(val).lower().strip()
                        if 'producto' in val_low:
                            column_mapping['producto'] = col_idx
                        elif 'cantidad' in val_low:
                            column_mapping['cantidad'] = col_idx
                break

        if detected_format is None:
            for idx, row in df.iterrows():
                non_null = [cell for cell in row if pd.notna(cell) and str(cell).strip()]
                if len(non_null) >= 2:
                    first = str(row.iloc[0]).lower().strip()
                    if first in ['stock', 'producto', 'nombre', 'descripción', '']:
                        continue
                    header_row_idx = idx
                    detected_format = 'generic_two_column'
                    column_mapping = {0: 'nombre', 1: 'cantidad'}
                    break
            else:
                header_row_idx = -1
                detected_format = 'generic_two_column'
                column_mapping = {0: 'nombre', 1: 'cantidad'}

        productos_creados = 0
        productos_actualizados = 0
        errores = []

        if detected_format == 'cadenas':
            start_row = header_row_idx + 1
            for idx, row in df.iloc[start_row:].iterrows():
                producto_raw = str(row.iloc[column_mapping.get('producto', 0)]).strip() if column_mapping.get('producto') is not None and pd.notna(row.iloc[column_mapping['producto']]) else ''
                calibre_raw = str(row.iloc[column_mapping.get('calibre', 1)]).strip() if column_mapping.get('calibre') is not None and pd.notna(row.iloc[column_mapping['calibre']]) else ''
                cantidad_raw = str(row.iloc[column_mapping.get('cantidad', 2)]).strip() if column_mapping.get('cantidad') is not None and pd.notna(row.iloc[column_mapping['cantidad']]) else ''
                set_raw = str(row.iloc[column_mapping.get('set', 3)]).strip() if column_mapping.get('set') is not None and pd.notna(row.iloc[column_mapping['set']]) else ''

                if not producto_raw or producto_raw.lower() in ['', 'nan', 'none']:
                    continue

                calibre_num = ''
                if calibre_raw and calibre_raw not in ['nan', 'none']:
                    match = re.search(r'(\d+(?:\.\d+)?)', calibre_raw)
                    if match:
                        calibre_num = match.group(1)

                nombre_base = ' '.join([p.capitalize() for p in producto_raw.split()])
                nombre_producto = f"{nombre_base} Calibre {calibre_num}" if calibre_num else nombre_base

                try:
                    cantidad = float(cantidad_raw) if cantidad_raw else 0.0
                except ValueError:
                    errores.append(f'Fila {idx}: cantidad inválida "{cantidad_raw}" para {nombre_producto}')
                    continue

                if cantidad <= 0:
                    continue

                if 'cadena' in producto_raw.lower():
                    presentacion = f"Cadena calibre {calibre_num}" if calibre_num else "Cadena de acero"
                    categoria = 'cadenas'
                elif 'kenter' in producto_raw.lower():
                    presentacion = f"Kenter calibre {calibre_num}" if calibre_num else "Conector Kenter"
                    categoria = 'accesorios_cadena'
                elif 'grillete giratorio' in producto_raw.lower():
                    presentacion = f"Grillete giratorio calibre {calibre_num}" if calibre_num else "Grillete giratorio"
                    categoria = 'accesorios_cadena'
                elif 'grillete' in producto_raw.lower():
                    presentacion = f"Grillete calibre {calibre_num}" if calibre_num else "Grillete"
                    categoria = 'accesorios_cadena'
                else:
                    presentacion = f"Componente calibre {calibre_num}" if calibre_num else "Componente"
                    categoria = 'otros'

                peso_estimado = self._estimar_peso_cadena(producto_raw, calibre_num)

                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre_producto,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': peso_estimado,
                            'stock_actual': cantidad,
                            'stock_minimo': 0,
                            'stock_maximo': 0,
                            'descripcion': f'Importado desde Excel de cadenas. Calibre: {calibre_num}, SET: {set_raw}, Cantidad original: {cantidad_raw}',
                            'categoria': categoria,
                        }
                    )
                    if created:
                        productos_creados += 1
                    else:
                        productos_actualizados += 1
                except Exception as e:
                    errores.append(f'Error guardando "{nombre_producto}": {str(e)}')

        elif detected_format == 'anclas':
            start_row = header_row_idx + 1
            kg_counts = {}
            kg_series = {}
            for idx, row in df.iloc[start_row:].iterrows():
                kg_val = ''
                if column_mapping.get('kg') is not None and pd.notna(row.iloc[column_mapping['kg']]):
                    kg_val = str(row.iloc[column_mapping['kg']]).strip()
                if not kg_val or kg_val.lower() in ['', 'nan', 'none']:
                    continue
                match = re.search(r'(\d+(?:\.\d+)?)', kg_val)
                if not match:
                    continue
                kg_num = float(match.group(1))
                serie = ''
                if column_mapping.get('serie') is not None and pd.notna(row.iloc[column_mapping['serie']]):
                    serie = str(row.iloc[column_mapping['serie']]).strip()
                if kg_num not in kg_counts:
                    kg_counts[kg_num] = 0
                    kg_series[kg_num] = []
                kg_counts[kg_num] += 1
                if serie:
                    kg_series[kg_num].append(serie)

            for kg, count in kg_counts.items():
                nombre_producto = f"Ancla {kg} kg"
                presentacion = f"Ancla de {kg} kg"
                descripcion = f"Peso unitario: {kg} kg. Números de serie: {', '.join(kg_series[kg]) if kg_series[kg] else 'No registrados'}"
                categoria = 'anclas'
                peso_unitario = kg
                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre_producto,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': peso_unitario,
                            'stock_actual': count,
                            'stock_minimo': 0,
                            'stock_maximo': 0,
                            'descripcion': descripcion,
                            'categoria': categoria,
                        }
                    )
                    if created:
                        productos_creados += 1
                    else:
                        productos_actualizados += 1
                except Exception as e:
                    errores.append(f'Error guardando "{nombre_producto}": {str(e)}')

        elif detected_format == 'insumos':
            start_row = header_row_idx + 1
            for idx, row in df.iloc[start_row:].iterrows():
                nombre = ''
                if column_mapping.get('nombre') is not None and pd.notna(row.iloc[column_mapping['nombre']]):
                    nombre = str(row.iloc[column_mapping['nombre']]).strip()
                if not nombre or nombre.lower() in ['', 'nan', 'none']:
                    continue

                cantidad_raw = ''
                if column_mapping.get('cantidad') is not None and pd.notna(row.iloc[column_mapping['cantidad']]):
                    cantidad_raw = str(row.iloc[column_mapping['cantidad']]).strip()
                match = re.search(r'(\d+(?:\.\d+)?)', cantidad_raw.replace(',', '.'))
                if not match:
                    errores.append(f'Producto "{nombre}": cantidad no válida "{cantidad_raw}"')
                    continue
                cantidad = float(match.group(1))

                estado = ''
                if column_mapping.get('estado') is not None and pd.notna(row.iloc[column_mapping['estado']]):
                    estado = str(row.iloc[column_mapping['estado']]).strip()
                observaciones = ''
                if column_mapping.get('observaciones') is not None and pd.notna(row.iloc[column_mapping['observaciones']]):
                    observaciones = str(row.iloc[column_mapping['observaciones']]).strip()
                ubicacion = ''
                if column_mapping.get('ubicacion') is not None and pd.notna(row.iloc[column_mapping['ubicacion']]):
                    ubicacion = str(row.iloc[column_mapping['ubicacion']]).strip()

                presentacion = ''
                if 'l' in cantidad_raw.lower() or 'litro' in cantidad_raw.lower():
                    presentacion = 'Líquido (Litros)'
                elif 'kg' in cantidad_raw.lower() or 'k' in cantidad_raw.lower():
                    presentacion = 'Sólido (Kg)'
                elif 'u' in cantidad_raw.lower() or 'unidad' in cantidad_raw.lower():
                    presentacion = 'Unidad'
                else:
                    presentacion = 'Sin especificar'

                categoria = 'insumos'
                descripcion = f"Estado: {estado}. Observaciones: {observaciones}. Ubicación: {ubicacion}".strip()
                if descripcion == "":
                    descripcion = f"Importado desde Excel de insumos. Cantidad original: {cantidad_raw}"

                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': 1.0,
                            'stock_actual': cantidad,
                            'stock_minimo': 0,
                            'stock_maximo': 0,
                            'descripcion': descripcion,
                            'categoria': categoria,
                        }
                    )
                    if created:
                        productos_creados += 1
                    else:
                        productos_actualizados += 1
                except Exception as e:
                    errores.append(f'Error guardando "{nombre}": {str(e)}')

        elif detected_format == 'quimicos':
            start_row = header_row_idx + 1
            for idx, row in df.iloc[start_row:].iterrows():
                producto = ''
                if column_mapping.get('producto') is not None and pd.notna(row.iloc[column_mapping['producto']]):
                    producto = str(row.iloc[column_mapping['producto']]).strip()
                if not producto or producto.lower() in ['', 'nan', 'none']:
                    continue

                cantidad_raw = ''
                if column_mapping.get('cantidad') is not None and pd.notna(row.iloc[column_mapping['cantidad']]):
                    cantidad_raw = str(row.iloc[column_mapping['cantidad']]).strip()
                if not cantidad_raw or cantidad_raw.lower() in ['', 'nan', 'none']:
                    continue

                match_num = re.search(r'(\d+(?:\.\d+)?)', cantidad_raw.replace(',', '.'))
                if not match_num:
                    errores.append(f'Producto "{producto}": cantidad no válida "{cantidad_raw}"')
                    continue
                cantidad = float(match_num.group(1))

                presentacion = ''
                if 'l' in cantidad_raw.lower():
                    presentacion = 'Líquido (Litros)'
                elif 'k' in cantidad_raw.lower():
                    presentacion = 'Sólido (Kg)'
                elif 'u' in cantidad_raw.lower():
                    presentacion = 'Unidad'
                else:
                    presentacion = 'Sin especificar'

                categoria = 'quimicos'
                descripcion = f"Importado desde Excel de químicos. Unidad original: {cantidad_raw}"

                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=producto,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': 1.0,
                            'stock_actual': cantidad,
                            'stock_minimo': 0,
                            'stock_maximo': 0,
                            'descripcion': descripcion,
                            'categoria': categoria,
                        }
                    )
                    if created:
                        productos_creados += 1
                    else:
                        productos_actualizados += 1
                except Exception as e:
                    errores.append(f'Error guardando "{producto}": {str(e)}')

        else:  # generic_two_column
            start_row = header_row_idx + 1 if header_row_idx >= 0 else 0
            for idx, row in df.iloc[start_row:].iterrows():
                nombre = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
                cantidad_raw = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else ''

                if not nombre or nombre.lower() in ['', 'nan', 'none']:
                    continue

                match = re.search(r'(\d+(?:\.\d+)?)', cantidad_raw.replace(',', '.'))
                if not match:
                    errores.append(f'Producto "{nombre}": cantidad no válida "{cantidad_raw}"')
                    continue
                cantidad = float(match.group(1))

                presentacion = ''
                if 'l' in cantidad_raw.lower():
                    presentacion = 'Líquido (Litros)'
                elif 'k' in cantidad_raw.lower():
                    presentacion = 'Sólido (Kg)'
                elif 'u' in cantidad_raw.lower():
                    presentacion = 'Unidad'
                else:
                    presentacion = 'Sin especificar'

                categoria = 'otros'
                descripcion = f'Importado desde Excel. Unidad original: {cantidad_raw}'

                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': 1.0,
                            'stock_actual': cantidad,
                            'stock_minimo': 0,
                            'stock_maximo': 0,
                            'descripcion': descripcion,
                            'categoria': categoria,
                        }
                    )
                    if created:
                        productos_creados += 1
                    else:
                        productos_actualizados += 1
                except Exception as e:
                    errores.append(f'Producto "{nombre}": error al guardar - {str(e)}')

        return Response({
            'message': 'Procesamiento completado',
            'creados': productos_creados,
            'actualizados': productos_actualizados,
            'errores': errores
        }, status=status.HTTP_200_OK)
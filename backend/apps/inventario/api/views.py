from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from apps.inventario.models import Articulo, MovimientoStock, Proveedor
from .serializers import ArticuloSerializer, MovimientoStockSerializer, ProveedorSerializer
import pandas as pd
import re
import logging

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

        # Determinar el motor de lectura según la extensión real
        try:
            if nombre_archivo.endswith('.xlsx'):
                engine = 'openpyxl'
            else:
                # Para .xls necesitamos xlrd, pero puede fallar si no está instalado
                try:
                    import xlrd
                    engine = 'xlrd'
                except ImportError:
                    return Response({'error': 'Para archivos .xls es necesario instalar la librería "xlrd". Ejecute: pip install xlrd'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Leer el archivo con pandas
            df = pd.read_excel(file, engine=engine)
        except Exception as e:
            # Mensaje de error más claro
            error_msg = str(e)
            if "zip file" in error_msg or "not a zip file" in error_msg:
                error_msg = "El archivo no es un Excel válido. Asegúrese de que la extensión coincida con el formato real."
            return Response({'error': f'Error al leer el archivo: {error_msg}'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalizar nombres de columnas
        df.columns = [str(col).strip().lower().replace(' ', '_') for col in df.columns]

        # Columnas esperadas
        expected_columns = ['nombre', 'contacto', 'telefono', 'email', 'direccion', 'rubro', 'condicion_pago']
        missing = [col for col in expected_columns if col not in df.columns]
        if missing:
            return Response({'error': f'Faltan columnas obligatorias: {", ".join(missing)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Valores válidos para condicion_pago
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
                    proveedor, created = Proveedor.objects.update_or_create(
                        nombre=nombre,
                        defaults=defaults
                    )
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
        """
        Descarga una plantilla Excel con las columnas requeridas y datos de ejemplo.
        """
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
            queryset = queryset.filter(categoria=categoria)
        return queryset

    @action(detail=False, methods=['post'])
    def movimiento(self, request):
        serializer = MovimientoStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            movimiento = serializer.save()
            articulo = movimiento.articulo
            
            if movimiento.tipo == 'INGRESO':
                nuevo_stock = articulo.stock_actual + movimiento.cantidad
            elif movimiento.tipo == 'SALIDA':
                if articulo.stock_actual < movimiento.cantidad:
                    return Response(
                        {'error': f'Stock insuficiente. Disponible: {articulo.stock_actual}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                nuevo_stock = articulo.stock_actual - movimiento.cantidad
            else:
                nuevo_stock = movimiento.cantidad
            
            articulo.stock_actual = nuevo_stock
            articulo.save()
            
            movimiento.stock_resultante = nuevo_stock
            movimiento.save(update_fields=['stock_resultante'])
        
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
                    'cantidad_necesaria': cantidad,
                    'disponible': disponible
                })
            except Articulo.DoesNotExist:
                resultados.append({'producto_id': pid, 'error': 'Producto no existe'})
            except ValueError:
                resultados.append({'producto_id': pid, 'error': 'Cantidad inválida'})
        
        return Response(resultados)

    # ------------------------------------------------------------
    # FUNCIÓN AUXILIAR PARA ESTIMAR PESO SEGÚN TIPO Y CALIBRE
    # ------------------------------------------------------------
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

    # ------------------------------------------------------------
    # CARGA DE EXCEL CON SOPORTE MEJORADO PARA CADENAS
    # ------------------------------------------------------------
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

        # ---------- Detección automática del formato ----------
        # Limpiar y normalizar primeras filas para buscar encabezados
        header_row_idx = None
        detected_format = None
        column_mapping = {}

        # Lista de posibles palabras clave para identificar fila de encabezado
        keywords = {
            'cadenas': ['productos', 'calibre', 'producto', 'tipo'],
            'anclas': ['kg', 'num serie', 'numero', 'peso'],
            'insumos': ['nombre', 'cantidad', 'estado', 'observaciones', 'ubicación'],
            'quimicos': ['producto', 'cantidad', 'stock']
        }

        for idx, row in df.iterrows():
            row_lower = [str(cell).lower().strip() for cell in row if pd.notna(cell)]
            # Buscar formato Cadenas
            if any('productos' in cell for cell in row_lower) and any('calibre' in cell for cell in row_lower):
                header_row_idx = idx
                detected_format = 'cadenas'
                # Mapear índices de columnas según el texto exacto
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
            # Buscar formato Anclas (columnas 'kg' o 'num serie')
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
                            column_mapping['numero'] = col_idx  # columna de número de ítem, opcional
                break
            # Buscar formato Insumos (Nombre, Cantidad, Estado...)
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
            # Buscar formato Químicos (Producto, Cantidad)
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

        # Si no se detectó un formato conocido, usar lógica genérica de dos columnas (primera columna = nombre, segunda = cantidad)
        if detected_format is None:
            # Buscar una fila que tenga al menos dos celdas no vacías y que no sea encabezado evidente
            for idx, row in df.iterrows():
                non_null = [cell for cell in row if pd.notna(cell) and str(cell).strip()]
                if len(non_null) >= 2:
                    # Si la primera celda tiene palabras como "stock", "producto", saltar (posible encabezado)
                    first = str(row.iloc[0]).lower().strip()
                    if first in ['stock', 'producto', 'nombre', 'descripción', '']:
                        continue
                    header_row_idx = idx
                    detected_format = 'generic_two_column'
                    column_mapping = {0: 'nombre', 1: 'cantidad'}
                    break
            else:
                # Si no se encuentra, asumir que los datos empiezan en fila 0
                header_row_idx = -1
                detected_format = 'generic_two_column'
                column_mapping = {0: 'nombre', 1: 'cantidad'}

        # ---------- Procesamiento según formato detectado ----------
        productos_creados = 0
        productos_actualizados = 0
        errores = []

        if detected_format == 'cadenas':
            # Lógica similar a la original pero con columnas dinámicas
            start_row = header_row_idx + 1
            for idx, row in df.iloc[start_row:].iterrows():
                producto_raw = str(row.iloc[column_mapping.get('producto', 0)]).strip() if column_mapping.get('producto') is not None and pd.notna(row.iloc[column_mapping['producto']]) else ''
                calibre_raw = str(row.iloc[column_mapping.get('calibre', 1)]).strip() if column_mapping.get('calibre') is not None and pd.notna(row.iloc[column_mapping['calibre']]) else ''
                cantidad_raw = str(row.iloc[column_mapping.get('cantidad', 2)]).strip() if column_mapping.get('cantidad') is not None and pd.notna(row.iloc[column_mapping['cantidad']]) else ''
                set_raw = str(row.iloc[column_mapping.get('set', 3)]).strip() if column_mapping.get('set') is not None and pd.notna(row.iloc[column_mapping['set']]) else ''

                if not producto_raw or producto_raw.lower() in ['', 'nan', 'none']:
                    continue

                # Limpiar calibre (extraer número)
                calibre_num = ''
                if calibre_raw and calibre_raw not in ['nan', 'none']:
                    import re
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

                # Determinar presentación y categoría
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
            # Agrupar por peso (kg)
            start_row = header_row_idx + 1
            kg_counts = {}
            kg_series = {}  # guardar números de serie opcionales
            for idx, row in df.iloc[start_row:].iterrows():
                kg_val = ''
                if column_mapping.get('kg') is not None and pd.notna(row.iloc[column_mapping['kg']]):
                    kg_val = str(row.iloc[column_mapping['kg']]).strip()
                if not kg_val or kg_val.lower() in ['', 'nan', 'none']:
                    continue
                # Extraer número del kg
                import re
                match = re.search(r'(\d+(?:\.\d+)?)', kg_val)
                if not match:
                    continue
                kg_num = float(match.group(1))
                serie = ''
                if column_mapping.get('serie') is not None and pd.notna(row.iloc[column_mapping['serie']]):
                    serie = str(row.iloc[column_mapping['serie']]).strip()
                # Contar
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
                peso_unitario = kg  # en kg
                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre_producto,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': peso_unitario,
                            'stock_actual': count,
                            'stock_minimo': 0,
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
                # Extraer cantidad numérica
                import re
                match = re.search(r'(\d+(?:\.\d+)?)', cantidad_raw.replace(',', '.'))
                if not match:
                    errores.append(f'Producto "{nombre}": cantidad no válida "{cantidad_raw}"')
                    continue
                cantidad = float(match.group(1))

                # Obtener estado y observaciones
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
                            'peso_kg': 1.0,  # por defecto, se puede ajustar manualmente si se necesita
                            'stock_actual': cantidad,
                            'stock_minimo': 0,
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

                # Extraer número y unidad
                import re
                match_num = re.search(r'(\d+(?:\.\d+)?)', cantidad_raw.replace(',', '.'))
                if not match_num:
                    errores.append(f'Producto "{producto}": cantidad no válida "{cantidad_raw}"')
                    continue
                cantidad = float(match_num.group(1))

                # Detectar unidad
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

                import re
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
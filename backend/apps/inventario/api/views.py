from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from apps.inventario.models import Articulo, MovimientoStock
from .serializers import ArticuloSerializer, MovimientoStockSerializer
import pandas as pd
import re
import logging

logger = logging.getLogger(__name__)

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
        """
        Retorna peso unitario estimado en kg para cada tipo de componente de cadena.
        Basado en valores típicos de la industria.
        """
        calibre = float(calibre) if calibre else 0
        tipo = tipo_producto.lower()
        
        # Pesos por calibre (kg por unidad)
        if 'cadena' in tipo:
            # Cadena de eslabones: peso por metro (aprox)
            pesos_por_calibre = {89: 12.5, 78: 9.8, 42: 3.2, 38: 2.6, 25: 1.2, 127: 24.0, 112: 19.0, 98: 14.5, 92: 12.0}
            return pesos_por_calibre.get(calibre, 1.0)
        elif 'kenter' in tipo:
            # Conectores Kenter: peso por unidad
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
        """
        Carga productos desde un archivo Excel.
        Soporta dos formatos:
        1. Formato químico: columnas A=Producto, B=Cantidad (con unidad)
        2. Formato cadenas: columnas PRODUCTOS, CALIBRE, CANTIDAD, SET
        Detecta automáticamente el formato.
        Asigna categoría 'quimicos' si el nombre contiene 'quimicos', sino 'otros'.
        Para cadenas, asigna nombre descriptivo y peso estimado.
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        nombre_archivo = file.name.lower()
        es_quimicos = 'quimicos' in nombre_archivo or 'quimico' in nombre_archivo

        if not (nombre_archivo.endswith('.xlsx') or nombre_archivo.endswith('.xls')):
            return Response({'error': 'Formato de archivo no soportado. Use .xlsx o .xls'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            engine = 'openpyxl' if nombre_archivo.endswith('.xlsx') else 'xlrd'
            df = pd.read_excel(file, header=None, dtype=str, engine=engine)
        except Exception as e:
            logger.error(f"Error al leer Excel: {e}")
            return Response({'error': f'Error al leer el archivo: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Detectar formato
        header_row_idx = None
        formato_cadenas = False
        for idx, row in df.iterrows():
            row_str = [str(cell).lower() for cell in row if pd.notna(cell)]
            if any('productos' in cell for cell in row_str) and any('calibre' in cell for cell in row_str):
                formato_cadenas = True
                header_row_idx = idx
                break
            if any('producto' in cell for cell in row_str) and not formato_cadenas:
                header_row_idx = idx
                break

        if header_row_idx is None:
            header_row_idx = -1

        productos_creados = 0
        productos_actualizados = 0
        errores = []

        if formato_cadenas:
            # ========== PROCESAMIENTO MEJORADO PARA CADENAS ==========
            data_start = header_row_idx + 1
            for idx, row in df.iloc[data_start:].iterrows():
                producto_raw = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
                calibre_raw = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
                cantidad_str = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ''
                set_str = str(row.iloc[3]).strip() if pd.notna(row.iloc[3]) else ''

                if not producto_raw or producto_raw.lower() in ['', 'nan', 'none']:
                    continue

                # Normalizar nombre del producto
                producto_limpio = producto_raw.strip()
                calibre = calibre_raw if calibre_raw and calibre_raw not in ['nan', 'none'] else ''

                # Construir nombre más descriptivo
                if calibre:
                    # Capitalizar primera letra de cada palabra
                    nombre_base = ' '.join([p.capitalize() for p in producto_limpio.split()])
                    nombre_producto = f"{nombre_base} Calibre {calibre}"
                else:
                    nombre_producto = producto_limpio.capitalize()

                # Extraer cantidad numérica
                try:
                    cantidad = float(cantidad_str) if cantidad_str else 0.0
                except ValueError:
                    errores.append(f'Fila {idx}: cantidad inválida para "{nombre_producto}" -> "{cantidad_str}"')
                    continue

                if cantidad <= 0:
                    continue

                # Determinar presentación legible
                if 'cadena' in producto_limpio.lower():
                    presentacion = f"Cadena calibre {calibre}" if calibre else "Cadena de acero"
                elif 'kenter' in producto_limpio.lower():
                    presentacion = f"Kenter calibre {calibre}" if calibre else "Conector Kenter"
                elif 'grillete giratorio' in producto_limpio.lower():
                    presentacion = f"Grillete giratorio calibre {calibre}" if calibre else "Grillete giratorio"
                elif 'grillete' in producto_limpio.lower():
                    presentacion = f"Grillete calibre {calibre}" if calibre else "Grillete"
                else:
                    presentacion = f"Componente calibre {calibre}" if calibre else "Componente"

                # Estimar peso unitario
                peso_estimado = self._estimar_peso_cadena(producto_limpio, calibre)

                # Categoría: 'otros' (podría ser 'insumos' si agregas al modelo)
                categoria = 'otros'

                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre_producto,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': peso_estimado,
                            'stock_actual': cantidad,
                            'descripcion': f'Importado desde Excel de cadenas. Calibre: {calibre}, SET: {set_str}, Cantidad original: {cantidad}',
                            'categoria': categoria,
                        }
                    )
                    if created:
                        productos_creados += 1
                    else:
                        productos_actualizados += 1
                except Exception as e:
                    errores.append(f'Error guardando "{nombre_producto}": {str(e)}')
        else:
            # ========== PROCESAMIENTO QUÍMICO O GENÉRICO (sin cambios) ==========
            if header_row_idx >= 0:
                start_row = header_row_idx + 1
            else:
                start_row = 0
                for idx, row in df.iterrows():
                    if pd.notna(row.iloc[0]) and str(row.iloc[0]).strip() and not str(row.iloc[0]).strip().lower().startswith('stock'):
                        start_row = idx
                        break

            for idx, row in df.iloc[start_row:].iterrows():
                nombre = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
                cantidad_str = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''

                if not nombre or nombre.lower() in ['', 'nan', 'none']:
                    continue

                match = re.search(r'([\d.,]+)', cantidad_str.replace(',', '.'))
                if not match:
                    errores.append(f'Producto "{nombre}": cantidad no válida "{cantidad_str}"')
                    continue

                try:
                    cantidad_num = float(match.group(1))
                except ValueError:
                    errores.append(f'Producto "{nombre}": cantidad no convertible a número "{cantidad_str}"')
                    continue

                presentacion = ''
                if 'L' in cantidad_str or 'l' in cantidad_str:
                    presentacion = 'Líquido (Litros)'
                elif 'k' in cantidad_str or 'Kg' in cantidad_str or 'K' in cantidad_str:
                    presentacion = 'Sólido (Kg)'
                elif 'U' in cantidad_str:
                    presentacion = 'Unidad'
                else:
                    presentacion = 'Sin especificar'

                categoria = 'quimicos' if es_quimicos else 'otros'

                try:
                    articulo, created = Articulo.objects.update_or_create(
                        nombre=nombre,
                        defaults={
                            'presentacion': presentacion,
                            'peso_kg': 1.0,
                            'stock_actual': cantidad_num,
                            'descripcion': f'Importado desde Excel. Unidad original: {cantidad_str}',
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
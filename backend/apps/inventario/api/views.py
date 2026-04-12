from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from apps.inventario.models import Articulo, MovimientoStock
from .serializers import ArticuloSerializer, MovimientoStockSerializer
import pandas as pd
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
import re


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Articulo.objects.all()
    serializer_class = ArticuloSerializer

    @action(detail=False, methods=['post'])
    def movimiento(self, request):
        """
        Registrar un movimiento de stock (ingreso, salida, ajuste)
        """
        serializer = MovimientoStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            movimiento = serializer.save()
            articulo = movimiento.articulo
            
            # Calcular nuevo stock
            if movimiento.tipo == 'INGRESO':
                nuevo_stock = articulo.stock_actual + movimiento.cantidad
            elif movimiento.tipo == 'SALIDA':
                if articulo.stock_actual < movimiento.cantidad:
                    return Response(
                        {'error': f'Stock insuficiente. Disponible: {articulo.stock_actual}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                nuevo_stock = articulo.stock_actual - movimiento.cantidad
            else:  # AJUSTE - la cantidad es el nuevo stock absoluto
                nuevo_stock = movimiento.cantidad
            
            articulo.stock_actual = nuevo_stock
            articulo.save()
            
            movimiento.stock_resultante = nuevo_stock
            movimiento.save(update_fields=['stock_resultante'])
        
        return Response(MovimientoStockSerializer(movimiento).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def disponibilidad(self, request):
        """
        Verificar stock de múltiples productos.
        Uso: /api/inventario/products/disponibilidad/?productos=1,2&cantidades=10,5
        """
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
                resultados.append({
                    'producto_id': pid,
                    'error': 'Producto no existe'
                })
            except ValueError:
                resultados.append({
                    'producto_id': pid,
                    'error': 'Cantidad inválida'
                })
        
        return Response(resultados)
    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
        """
        Carga productos desde un archivo Excel.
        Espera un archivo con columnas: PRODUCTO, CANTIDAD.
        La cantidad puede incluir unidades (L, k, U, etc.) y se extrae el número.
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Leer Excel usando pandas
            df = pd.read_excel(file, header=None, dtype=str)
        except Exception as e:
            return Response({'error': f'Error al leer el archivo: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Buscar la fila donde aparece "PRODUCTO" (insensible a mayúsculas)
        start_row = None
        for idx, row in df.iterrows():
            if row.astype(str).str.lower().str.contains('producto').any():
                start_row = idx + 1  # siguiente fila son los datos
                break
        if start_row is None:
            return Response({'error': 'No se encontró la columna PRODUCTO en el archivo'}, status=status.HTTP_400_BAD_REQUEST)

        # Asumimos que la columna A es producto, columna B es cantidad
        productos_creados = 0
        productos_actualizados = 0
        errores = []

        for idx, row in df.iloc[start_row:].iterrows():
            nombre = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
            cantidad_str = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''

            if not nombre or nombre.lower() in ['', 'nan', 'none']:
                continue  # saltar filas vacías

            # Extraer número de la cantidad (ej: "410 L" -> 410, "83 k" -> 83, "20" -> 20)
            match = re.search(r'([\d.,]+)', cantidad_str.replace(',', '.'))
            if not match:
                errores.append(f'Producto "{nombre}": cantidad no válida "{cantidad_str}"')
                continue

            cantidad_num = float(match.group(1))

            # Determinar presentación a partir de la unidad (si existe)
            presentacion = ''
            if 'L' in cantidad_str or 'l' in cantidad_str:
                presentacion = 'Líquido (Litros)'
            elif 'k' in cantidad_str or 'Kg' in cantidad_str:
                presentacion = 'Sólido (Kg)'
            elif 'U' in cantidad_str:
                presentacion = 'Unidad'
            else:
                presentacion = 'Sin especificar'

            # Crear o actualizar el artículo
            articulo, created = Articulo.objects.update_or_create(
                nombre=nombre,
                defaults={
                    'presentacion': presentacion,
                    'peso_kg': 1.0,  # valor por defecto, se puede ajustar manualmente luego
                    'stock_actual': cantidad_num,
                    'descripcion': f'Importado desde Excel. Unidad original: {cantidad_str}'
                }
            )
            if created:
                productos_creados += 1
            else:
                productos_actualizados += 1

        return Response({
            'message': 'Procesamiento completado',
            'creados': productos_creados,
            'actualizados': productos_actualizados,
            'errores': errores
        }, status=status.HTTP_200_OK)
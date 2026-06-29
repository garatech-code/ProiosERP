from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as filters
from django_filters.filters import BaseInFilter, CharFilter
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.core.paginator import Paginator
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated, BasePermission
from apps.inventario.models import Articulo, MovimientoStock, Proveedor, ProductoLog, StockItem
from .serializers import ArticuloSerializer, MovimientoStockSerializer, ProveedorSerializer, ProductoLogSerializer, StockItemSerializer
import pandas as pd
import unicodedata
import logging
from io import BytesIO
import csv

logger = logging.getLogger(__name__)


# ================= PERMISO PERSONALIZADO PARA OPERARIOS =================
class IsOperarioReadOnly(BasePermission):
    """
    Permite a los usuarios con grupo 'OPERARIO' solo lectura (GET, HEAD, OPTIONS)
    y la acción específica 'movimiento' (registrar movimientos).
    No pueden crear, editar ni eliminar productos.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        if request.user.groups.filter(name='OPERARIO').exists():
            if request.method in ('GET', 'HEAD', 'OPTIONS'):
                return True
            if view.action == 'movimiento':
                return True
            return False
        return True


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filterset_fields = ['nombre', 'rubro']

    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
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


class ProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 10000


# ================= FILTRO PERSONALIZADO PARA MÚLTIPLES CATEGORÍAS =================
class CharInFilter(BaseInFilter, CharFilter):
    """Permite filtrar por múltiples valores separados por coma (ej. ?categoria=otros,insumos,anclas)"""
    pass


class ProductFilter(filters.FilterSet):
    categoria = CharInFilter(field_name='categoria', lookup_expr='in')

    class Meta:
        model = Articulo
        fields = ['categoria', 'ubicacion', 'estado', 'unidad']


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ArticuloSerializer
    pagination_class = ProductPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter  # Usa el filtro personalizado
    search_fields = ['nombre', 'descripcion', 'presentacion']
    ordering_fields = ['id', 'nombre', 'stock_actual', 'stock_minimo', 'stock_maximo', 'categoria', 'ubicacion', 'estado', 'unidad']
    ordering = ['id']
    permission_classes = [IsAuthenticated, IsOperarioReadOnly]

    def get_queryset(self):
        return Articulo.objects.all()

    def list(self, request, *args, **kwargs):
        export = request.query_params.get('export')
        if export in ['csv', 'excel']:
            queryset = self.filter_queryset(self.get_queryset())
            data = []
            for art in queryset:
                data.append({
                    'nombre': getattr(art, 'nombre', None) or '-',
                    'categoria': getattr(art, 'categoria', None) or '-',
                    'cantidad': float(getattr(art, 'stock_actual', 0) or 0),
                    'unidad': getattr(art, 'unidad', None) or '-',
                    'ubicacion': getattr(art, 'ubicacion', None) or '-',
                    'estado': getattr(art, 'estado', None) or '-',
                    'serie_lote': getattr(art, 'serie_lote', None) or '-',
                    'observaciones': getattr(art, 'descripcion', None) or '-',
                    'min': float(getattr(art, 'stock_minimo', 0) or 0),
                    'max': float(getattr(art, 'stock_maximo', 0) or 0),
                })
            
            if export == 'csv':
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="inventario_stock.csv"'
                if data:
                    writer = csv.DictWriter(response, fieldnames=data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)
                return response
            else:
                df = pd.DataFrame(data)
                output = BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name='Stock')
                output.seek(0)
                response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                response['Content-Disposition'] = 'attachment; filename="inventario_stock.xlsx"'
                return response

        return super().list(request, *args, **kwargs)

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def perform_update(self, serializer):
        producto = self.get_object()
        old_stock = producto.stock_actual
        producto = serializer.save()
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
        if self.request.user.is_authenticated:
            producto.modificado_por = self.request.user
            producto.save(update_fields=['modificado_por'])

        old_data = {
            'nombre': producto.nombre,
            'descripcion': producto.descripcion,
            'presentacion': producto.presentacion,
            'peso_kg': float(producto.peso_kg),
            'stock_actual': float(old_stock),
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

    @action(detail=False, methods=['delete'], url_path='delete_all')
    def delete_all(self, request):
        count = self.get_queryset().count()
        self.get_queryset().delete()
        return Response({'message': f'Se eliminaron {count} productos exitosamente.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def movimiento(self, request):
        serializer = MovimientoStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            articulo_id = serializer.validated_data['articulo'].id
            articulo = Articulo.objects.select_for_update().get(id=articulo_id)
            cantidad = serializer.validated_data['cantidad']
            tipo = serializer.validated_data['tipo']
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
            movimiento = MovimientoStock.objects.create(
                articulo=articulo,
                tipo=tipo,
                cantidad=cantidad,
                stock_resultante=nuevo_stock,
                operacion_id=serializer.validated_data.get('operacion_id'),
                razon=serializer.validated_data['razon'],
                usuario=request.user if request.user.is_authenticated else None
            )
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
        queryset = MovimientoStock.objects.select_related('articulo', 'usuario').order_by('-fecha')
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

    @action(detail=False, methods=['get'], url_path='logs')
    def listar_logs(self, request):
        producto_id = request.query_params.get('producto_id')
        queryset = ProductoLog.objects.select_related('producto', 'usuario').order_by('-fecha')
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)
        serializer = ProductoLogSerializer(queryset[:200], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='categorias')
    def listar_categorias(self, request):
        categorias = Articulo.objects.values_list('categoria', flat=True).distinct().order_by('categoria')
        data = [{'value': cat, 'label': cat.capitalize()} for cat in categorias if cat]
        return Response(data)

    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
        """
        Importa artículos desde un Excel estándar.
        Columnas exactas: nombre, categoria, cantidad, unidad, ubicacion, estado, serie_lote, observaciones, min, max
        Los valores "xx" o "-" se convierten a cadena vacía o 0 dependiendo de si es texto o número.
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=400)
        if not file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'Formato de archivo no soportado. Use .xlsx o .xls'}, status=400)

        try:
            df = pd.read_excel(file, engine='openpyxl' if file.name.endswith('.xlsx') else 'xlrd')
        except Exception as e:
            logger.error(f"Error al leer Excel: {e}")
            return Response({'error': f'Error al leer el archivo: {str(e)}'}, status=400)

        df.columns = [str(col).strip().lower().replace(' ', '_') for col in df.columns]

        required_cols = ['nombre', 'categoria', 'cantidad', 'unidad', 'ubicacion', 'estado', 'serie_lote', 'observaciones', 'min', 'max']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return Response({'error': f'Faltan columnas: {missing}'}, status=400)

        def normalize_text(s):
            if not isinstance(s, str):
                return ''
            s = s.strip().lower()
            s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
            return s

        def clean_empty(val):
            if pd.notna(val):
                v_str = str(val).strip()
                if v_str == '-':
                    return ''
                return v_str
            return ''

        creados = 0
        actualizados = 0
        errores = []

        for idx, row in df.iterrows():
            nombre = str(row['nombre']).strip() if pd.notna(row['nombre']) else ''
            if not nombre:
                errores.append(f"Fila {idx+2}: nombre vacío")
                continue

            cat_input_raw = str(row['categoria']).strip() if pd.notna(row['categoria']) else ''
            categoria = cat_input_raw.lower() if cat_input_raw and cat_input_raw != '-' else '-'

            try:
                c_val = str(row['cantidad']).strip()
                if c_val == '-': c_val = '0'
                cantidad = float(c_val) if pd.notna(row['cantidad']) else 0.0
                if cantidad < 0:
                    errores.append(f"Fila {idx+2}: cantidad negativa")
                    continue
            except:
                errores.append(f"Fila {idx+2}: cantidad no numérica")
                continue

            try:
                m_val = str(row['min']).strip()
                if m_val == '-': m_val = '0'
                min_val = float(m_val) if 'min' in df.columns and pd.notna(row['min']) else 0.0
            except:
                min_val = 0.0

            try:
                mx_val = str(row['max']).strip()
                if mx_val == '-': mx_val = '0'
                max_val = float(mx_val) if 'max' in df.columns and pd.notna(row['max']) else 0.0
            except:
                max_val = 0.0

            unidad = clean_empty(row['unidad'])
            ubicacion = clean_empty(row['ubicacion'])
            estado = clean_empty(row['estado'])
            serie_lote = clean_empty(row['serie_lote'])
            observaciones = clean_empty(row['observaciones'])

            presentacion = unidad if unidad else 'unidad'
            peso_kg = 1.0

            defaults = {
                'descripcion': observaciones,
                'presentacion': presentacion,
                'peso_kg': peso_kg,
                'stock_actual': cantidad,
                'stock_minimo': min_val,
                'stock_maximo': max_val,
                'categoria': categoria,
                'controlar_stock': True,
                'unidad': unidad,
                'ubicacion': ubicacion,
                'estado': estado,
                'serie_lote': serie_lote,
            }

            try:
                articulo, created = Articulo.objects.update_or_create(
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
            'message': 'Procesamiento completado',
            'creados': creados,
            'actualizados': actualizados,
            'errores': errores[:20]
        }, status=200)


class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all().order_by('nombre')
    serializer_class = StockItemSerializer
    filterset_fields = ['categoria', 'ubicacion', 'estado']

    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
        """
        Importa stock desde un Excel ESTÁNDAR para el modelo StockItem.
        Columnas EXACTAS: nombre, categoria, cantidad, unidad, ubicacion, estado, serie_lote, observaciones
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó archivo'}, status=status.HTTP_400_BAD_REQUEST)
        if not file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'Solo archivos .xlsx o .xls'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file, engine='openpyxl' if file.name.endswith('.xlsx') else 'xlrd')
        except Exception as e:
            return Response({'error': f'Error al leer Excel: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        df.columns = [str(col).strip().lower().replace(' ', '_') for col in df.columns]

        columnas_requeridas = ['nombre', 'categoria', 'cantidad', 'unidad', 'ubicacion', 'estado', 'serie_lote', 'observaciones']
        missing = [col for col in columnas_requeridas if col not in df.columns]
        if missing:
            return Response({'error': f'Faltan columnas: {missing}'}, status=status.HTTP_400_BAD_REQUEST)

        creados = 0
        actualizados = 0
        errores = []

        def clean_empty_stock(val):
            if pd.notna(val):
                v_str = str(val).strip()
                if v_str == '-':
                    return ''
                return v_str
            return ''

        for idx, row in df.iterrows():
            nombre = clean_empty_stock(row['nombre'])
            if not nombre:
                errores.append(f"Fila {idx+2}: nombre vacío")
                continue

            categoria = row['categoria']
            if categoria not in dict(StockItem.CATEGORIA_CHOICES):
                errores.append(f"Fila {idx+2}: categoria '{categoria}' no válida")
                continue

            unidad = clean_empty_stock(row['unidad'])
            if unidad not in dict(StockItem.UNIDAD_CHOICES):
                errores.append(f"Fila {idx+2}: unidad '{unidad}' no válida")
                continue

            ubicacion = clean_empty_stock(row['ubicacion'])
            if ubicacion not in dict(StockItem.UBICACION_CHOICES):
                errores.append(f"Fila {idx+2}: ubicacion '{ubicacion}' no válida")
                continue

            estado = clean_empty_stock(row['estado'])
            if estado not in dict(StockItem.ESTADO_CHOICES):
                errores.append(f"Fila {idx+2}: estado '{estado}' no válido")
                continue

            try:
                c_val = str(row['cantidad']).strip()
                if c_val == '-': c_val = '0'
                cantidad = float(c_val)
                if cantidad < 0:
                    errores.append(f"Fila {idx+2}: cantidad negativa")
                    continue
            except:
                errores.append(f"Fila {idx+2}: cantidad no numérica")
                continue

            serie_lote = clean_xx(row['serie_lote'])
            observaciones = clean_xx(row['observaciones'])

            defaults = {
                'categoria': categoria,
                'cantidad': cantidad,
                'unidad': unidad,
                'ubicacion': ubicacion,
                'estado': estado,
                'serie_lote': serie_lote,
                'observaciones': observaciones,
            }

            obj, created = StockItem.objects.update_or_create(
                nombre=nombre,
                defaults=defaults
            )
            if created:
                creados += 1
            else:
                actualizados += 1

        return Response({
            'creados': creados,
            'actualizados': actualizados,
            'errores': errores[:20]
        })
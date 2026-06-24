# pyrefly: ignore [missing-import]
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ValidationError
from decimal import Decimal
from apps.produccion.models import FormulaBOM, OrdenFabricacion
from apps.inventario.models import Articulo, MovimientoStock
from apps.usuarios.models import User
from .serializers import FormulaBOMSerializer, OrdenFabricacionSerializer

class FormulaViewSet(viewsets.ModelViewSet):
    queryset = FormulaBOM.objects.all()
    serializer_class = FormulaBOMSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        articulo_id = self.request.query_params.get('articulo_final_id', None)
        if articulo_id is not None:
            queryset = queryset.filter(articulo_final_id=articulo_id)
        return queryset


class OrdenFabricacionViewSet(viewsets.ModelViewSet):
    queryset = OrdenFabricacion.objects.all()
    serializer_class = OrdenFabricacionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # OPERARIOS: ven solo órdenes pendientes (no completadas)
        if user.role == User.Role.OPERARIO:
            return OrdenFabricacion.objects.filter(completada=False).order_by('-fecha_solicitud')
        
        # OWNER, OPERADOR, CONTABLE ven todas
        queryset = super().get_queryset()
        operacion_id = self.request.query_params.get('operacion_id', None)
        if operacion_id is not None:
            queryset = queryset.filter(operacion_id=operacion_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == User.Role.OPERARIO:
            raise ValidationError("No autorizado para crear órdenes de fabricación")
        serializer.save()

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        """Permite completar una orden de fabricación (ahora también para OPERARIO)"""
        user = request.user
        
        # Permitir a OPERARIO completar (antes solo OWNER/OPERADOR)
        if user.role not in [User.Role.OWNER, User.Role.OPERADOR, User.Role.OPERARIO]:
            return Response({'error': 'No autorizado para completar órdenes de fabricación'}, 
                          status=status.HTTP_403_FORBIDDEN)
            
        orden = self.get_object()
        if orden.completada:
            return Response({'error': 'La orden de fabricación ya está completada'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        formula = orden.formula
        componentes = formula.componentes.all()
        
        if not componentes.exists():
            return Response({'error': 'La fórmula no tiene componentes definidos'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Bloquear insumos
            insumo_ids = [c.insumo_id for c in componentes]
            insumos_qs = Articulo.objects.select_for_update().filter(id__in=insumo_ids)
            insumos_map = {item.id: item for item in insumos_qs}
            
            # Validar existencia de todos los insumos
            for comp in componentes:
                if comp.insumo_id not in insumos_map:
                    return Response({'error': f'El artículo insumo ID {comp.insumo_id} no existe en inventario'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
            
            # Validar niveles de stock
            errores = []
            for comp in componentes:
                insumo = insumos_map[comp.insumo_id]
                cantidad_necesaria = comp.cantidad_requerida * orden.cantidad_a_producir
                if insumo.stock_actual < cantidad_necesaria:
                    errores.append({
                        'insumo_id': insumo.id,
                        'nombre': insumo.nombre,
                        'disponible': float(insumo.stock_actual),
                        'necesario': float(cantidad_necesaria)
                    })
            
            if errores:
                return Response({
                    'error': 'Insumos insuficientes en inventario para completar la producción',
                    'detalles': errores
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Bloquear artículo final
            try:
                articulo_final = Articulo.objects.select_for_update().get(id=formula.articulo_final_id)
            except Articulo.DoesNotExist:
                return Response({'error': 'El artículo final de la fórmula no existe en inventario'}, 
                              status=status.HTTP_400_BAD_REQUEST)

            # Consumir insumos (SALIDA)
            for comp in componentes:
                insumo = insumos_map[comp.insumo_id]
                cantidad_necesaria = (comp.cantidad_requerida * orden.cantidad_a_producir).quantize(Decimal('0.0001'))
                stock_resultante = (insumo.stock_actual - cantidad_necesaria).quantize(Decimal('0.0001'))
                
                MovimientoStock.objects.create(
                    articulo=insumo,
                    tipo='SALIDA',
                    cantidad=cantidad_necesaria,
                    stock_resultante=stock_resultante,
                    operacion_id=orden.operacion_id,
                    razon=f"Consumo de insumo por Orden de Fabricación #{orden.id}",
                    usuario=user
                )
                insumo.stock_actual = stock_resultante
                insumo.save()
            
            # Incrementar stock del artículo final (INGRESO)
            cantidad_final = orden.cantidad_a_producir.quantize(Decimal('0.0001'))
            stock_resultante_final = (articulo_final.stock_actual + cantidad_final).quantize(Decimal('0.0001'))
            
            MovimientoStock.objects.create(
                articulo=articulo_final,
                tipo='INGRESO',
                cantidad=cantidad_final,
                stock_resultante=stock_resultante_final,
                operacion_id=orden.operacion_id,
                razon=f"Ingreso de producto terminado por Orden de Fabricación #{orden.id}",
                usuario=user
            )
            articulo_final.stock_actual = stock_resultante_final
            articulo_final.save()
            
            # Marcar orden completada
            orden.completada = True
            orden.save()
            
        return Response({
            'status': 'completada',
            'message': f'Orden de fabricación #{orden.id} completada con éxito. Se produjeron {orden.cantidad_a_producir} unidades.',
            'orden': OrdenFabricacionSerializer(orden).data
        })
    
    @action(detail=False, methods=['get'], url_path='mis-tareas')
    def mis_tareas(self, request):
        """Endpoint específico para que el operario vea sus tareas pendientes (formato amigable)"""
        user = request.user
        if user.role != User.Role.OPERARIO:
            return Response({'error': 'Solo para operarios'}, status=403)
        
        # Obtener órdenes pendientes con datos enriquecidos
        ordenes = OrdenFabricacion.objects.filter(completada=False).order_by('-fecha_solicitud')
        
        resultados = []
        for orden in ordenes:
            from apps.operaciones.models import Operacion
            try:
                operacion = Operacion.objects.get(id=orden.operacion_id)
                nombre_operacion = f"OP-{operacion.id:05d}"
                if operacion.nombre:
                    nombre_operacion = operacion.nombre
            except Operacion.DoesNotExist:
                nombre_operacion = f"Operación #{orden.operacion_id}"
            
            resultados.append({
                'id': orden.id,
                'operacion_id': orden.operacion_id,
                'operacion_nombre': nombre_operacion,
                'producto_nombre': orden.formula.articulo_final_nombre,
                'cantidad_a_producir': float(orden.cantidad_a_producir),
                'formula_nombre': orden.formula.nombre,
                'fecha_solicitud': orden.fecha_solicitud,
                'completada': orden.completada,
            })
        
        return Response(resultados)
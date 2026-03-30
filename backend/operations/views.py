from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import F
from .models import Resource, Event
from .serializers import ResourceSerializer
from core.permissions import IsManagerOrAdmin
import logging

logger = logging.getLogger(__name__)

class ResourceViewSet(viewsets.ModelViewSet):
    """
    ViewSet para manejar la lógica de Recursos.
    Demuestra: Transacciones atómicas, pessimistic locking, F() expressions.
    """
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Queryset Security:
        Filtra querysets basados en el rol del usuario y ownership.
        """
        user = self.request.user
        if user.role in [user.Role.ADMIN, user.Role.MANAGER]:
            return Resource.objects.all()
        # Operadores o visualizadores solo ven sus propios recursos
        return Resource.objects.filter(owner=user)

    def perform_create(self, serializer):
        """
        Crea un recurso y registra un evento Outbox usando transacción atómica.
        """
        with transaction.atomic():
            resource = serializer.save(owner=self.request.user)
            
            # Transactional Outbox Pattern: guardar evento en misma transacción
            Event.objects.create(
                type="RESOURCE_CREATED",
                payload={"resource_id": str(resource.id), "name": resource.name}
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def update_stock(self, request, pk=None):
        """
        Endpoint que demuestra concurrencia y atomicidad para reducir el stock.
        """
        amount = int(request.data.get('amount', 1))
        
        try:
            with transaction.atomic():
                # Pessimistic Locking: select_for_update() asegura que otra trx no pueda modificar
                resource = Resource.objects.select_for_update().get(pk=pk)
                
                # Check business logic
                if resource.stock < amount:
                    return Response(
                        {"error": "Stock insuficiente"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Atomic Update: usar F expresion
                # resource.stock = F('stock') - amount
                # Sin embargo, dado que bloqueamos la fila, podemos operar en el valor cargado en memoria,
                # pero combinaremos para demostrar ambos requerimientos.
                Resource.objects.filter(pk=resource.pk).update(stock=F('stock') - amount)
                
                # Outbox event
                Event.objects.create(
                    type="STOCK_UPDATED",
                    payload={"resource_id": str(resource.id), "amount_reduced": amount}
                )

            return Response({"status": "Stock updated and outbox event created."}, status=status.HTTP_200_OK)

        except Resource.DoesNotExist:
            return Response({"error": "No encontrado"}, status=status.HTTP_404_NOT_FOUND)

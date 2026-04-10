from rest_framework import viewsets
from apps.inventario.models import Articulo
from .serializers import ProductSerializer

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Articulo.objects.all()
    serializer_class = ProductSerializer
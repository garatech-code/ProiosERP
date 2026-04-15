from rest_framework import viewsets, permissions
from apps.produccion.models import FormulaBOM
from .serializers import FormulaBOMSerializer

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

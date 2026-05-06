import pandas as pd
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from ..models import PersonalPlantel
from .staff_serializers import PersonalPlantelSerializer

class PersonalPlantelViewSet(viewsets.ModelViewSet):
    queryset = PersonalPlantel.objects.all()
    serializer_class = PersonalPlantelSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombres', 'apellidos', 'dni', 'rol']

    def get_queryset(self):
        qs = super().get_queryset()
        activo = self.request.query_params.get('activo', None)
        if activo is not None:
            is_active = activo.lower() in ['true', '1', 'yes', 't']
            qs = qs.filter(activo=is_active)
        return qs

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No se proporcionaron IDs'}, status=status.HTTP_400_BAD_REQUEST)
        
        PersonalPlantel.objects.filter(id__in=ids).delete()
        return Response({'message': f'Se eliminaron {len(ids)} registros'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Leer el archivo Excel
            df = pd.read_excel(file)
            
            # Normalizar nombres de columnas a mayúsculas para evitar problemas de case-sensitivity
            df.columns = [str(c).strip().upper() for c in df.columns]
            
            required_cols = ['NOMBRES', 'APELLIDOS', 'DNI', 'ROL']
            missing_cols = [c for c in required_cols if c not in df.columns]
            
            if missing_cols:
                return Response({
                    'error': f'Faltan las siguientes columnas: {", ".join(missing_cols)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            created_count = 0
            errors = []

            with transaction.atomic():
                for index, row in df.iterrows():
                    dni = str(row['DNI']).strip()
                    try:
                        # Usar update_or_create para evitar duplicados por DNI si ya existen
                        # o simplemente create si queremos fallar en duplicados. 
                        # El requerimiento dice "generar los registros", usaremos get_or_create o similar.
                        obj, created = PersonalPlantel.objects.update_or_create(
                            dni=dni,
                            defaults={
                                'nombres': str(row['NOMBRES']).strip(),
                                'apellidos': str(row['APELLIDOS']).strip(),
                                'rol': str(row['ROL']).strip(),
                                'activo': True
                            }
                        )
                        if created:
                            created_count += 1
                    except Exception as e:
                        errors.append(f"Error en fila {index + 2} (DNI {dni}): {str(e)}")

            if errors:
                # Si hay errores, lanzamos una excepción para que el transaction.atomic haga rollback
                # pero el usuario quiere "carga atómica", así que si hay un solo error, nada se guarda.
                # Nota: transaction.atomic revertirá todo si levantamos una excepción.
                raise Exception("\n".join(errors))

            return Response({
                'message': f'Importación exitosa. Se crearon/actualizaron {len(df)} registros.',
                'created': created_count
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

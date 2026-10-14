from django.core.management.base import BaseCommand
from apps.operaciones.tasks import verificar_inactividad_operaciones_24h


class Command(BaseCommand):
    help = 'Verifica operaciones con mas de 24 horas sin avances desde su creacion/asignacion y envia alerta a eva@proios.com'

    def handle(self, *args, **options):
        self.stdout.write("Iniciando revision de inactividad de operaciones (plazo 24hs)...")
        resultado = verificar_inactividad_operaciones_24h()
        self.stdout.write(self.style.SUCCESS(resultado))

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operaciones', '0038_operacion_expensas'),
    ]

    operations = [
        migrations.AddField(
            model_name='operacion',
            name='fecha_inicio_control_operador',
            field=models.DateTimeField(blank=True, help_text='Fecha y hora de inicio del control de inactividad (creación por operador o asignación)', null=True),
        ),
        migrations.AddField(
            model_name='operacion',
            name='alerta_inactividad_24h_enviada',
            field=models.BooleanField(default=False, help_text='Indica si se envió la alerta de inactividad de 24hs a Eva Proios'),
        ),
        migrations.AddField(
            model_name='operacion',
            name='fecha_alerta_inactividad_24h',
            field=models.DateTimeField(blank=True, help_text='Fecha y hora de envío de la alerta de 24hs a Eva Proios', null=True),
        ),
    ]

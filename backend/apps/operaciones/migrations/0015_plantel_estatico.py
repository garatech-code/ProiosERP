from django.db import migrations, models

def migrate_m2m_to_json(apps, schema_editor):
    Operacion = apps.get_model('operaciones', 'Operacion')
    for op in Operacion.objects.all():
        plantel_datos = []
        # Access the M2M safely through the historical models
        for operario in op.operarios_asignados.all():
            plantel_datos.append({
                'id': operario.id,
                'nombres': operario.nombres,
                'apellidos': operario.apellidos,
                'dni': operario.dni,
                'rol': operario.rol
            })
        if plantel_datos:
            op.plantel_asignado = plantel_datos
            op.save()

class Migration(migrations.Migration):

    dependencies = [
        ('operaciones', '0014_alter_operacion_tipo_operacion'),
    ]

    operations = [
        migrations.AddField(
            model_name='operacion',
            name='plantel_asignado',
            field=models.JSONField(blank=True, default=list, help_text='Snapshot estático de los operarios asignados'),
        ),
        migrations.RunPython(migrate_m2m_to_json, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='operacion',
            name='operarios_asignados',
        ),
    ]

import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proios.settings.development')
django.setup()
from django.apps import apps

with open('schema.md', 'w', encoding='utf-8') as f:
    f.write('# ProIOS Database Schema\n\n')
    for app in apps.get_app_configs():
        if app.name.startswith('django') or app.name.startswith('rest_') or app.name.startswith('cors'):
            continue
        f.write(f'## App: {app.name}\n\n')
        for model in app.get_models():
            f.write(f'### Model: {model.__name__}\n')
            f.write('| Field | Type | Attributes |\n')
            f.write('|---|---|---|\n')
            for field in model._meta.get_fields():
                help_text = getattr(field, 'help_text', '')
                if not isinstance(help_text, str):
                    help_text = str(help_text)
                f.write(f'| {field.name} | {field.__class__.__name__} | {help_text} |\n')
            f.write('\n')

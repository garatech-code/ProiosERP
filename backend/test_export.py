import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proios.settings")
sys.path.append(r"c:\Users\Antonio Riveros\Documents\Laburo\stock\Stock\backend")
django.setup()

from apps.inventario.api.views import ProductViewSet
from django.test import RequestFactory

factory = RequestFactory()
request = factory.get('/api/inventario/products/?export=excel')

view = ProductViewSet.as_view({'get': 'list'})
response = view(request)

if response.status_code == 200:
    print("Success! File size:", len(response.content))
else:
    print("Error:", response.status_code, response.content)

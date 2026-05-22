from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.operaciones.models import Client, Ship, Port, Operacion, OperacionDetalle
from apps.inventario.models import Articulo, MovimientoStock, Proveedor
from apps.produccion.models import FormulaBOM, ComponenteBOM, OrdenFabricacion
from rest_framework.test import APIClient
from rest_framework import status
from django.db import transaction
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

class ProiosFlowIntegrationTestCase(TestCase):
    def setUp(self):
        # Create users
        self.owner = User.objects.create_user(username='owner_user', password='password123', role='OWNER')
        self.operario = User.objects.create_user(username='operario_user', password='password123', role='OPERARIO')
        
        # API clients
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(user=self.owner)
        self.operario_client = APIClient()
        self.operario_client.force_authenticate(user=self.operario)
        
        # Create Client, Ship, Port
        self.client = Client.objects.create(name="Test Client", email="test@client.com")
        self.ship = Ship.objects.create(name="Test Ship", flag="AR")
        self.port = Port.objects.create(name="Test Port", country="Argentina")
        
        # Create Proveedor
        self.proveedor = Proveedor.objects.create(nombre="Test Proveedor")
        
        # Create Articulos
        # Article 1: Finished Product (has a BOM formula)
        self.prod_finished = Articulo.objects.create(
            nombre="Finished Product A",
            presentacion="Tambor 20L",
            peso_kg=20.00,
            stock_actual=10.0,  # Insufficient stock for order of 15
            categoria="quimicos",
            proveedor=self.proveedor
        )
        
        # Article 2: Insumo (part of BOM)
        self.prod_insumo = Articulo.objects.create(
            nombre="Raw Material B",
            presentacion="Bidon 5L",
            peso_kg=5.00,
            stock_actual=100.0,  # Enough raw material to produce 5 units
            categoria="quimicos",
            proveedor=self.proveedor
        )
        
        # Create BOM Formula
        self.formula = FormulaBOM.objects.create(
            nombre="Formula for Product A",
            articulo_final_id=self.prod_finished.id,
            activa=True
        )
        # 1 unit of finished product requires 2 units of raw material
        self.componente = ComponenteBOM.objects.create(
            formula=self.formula,
            insumo_id=self.prod_insumo.id,
            cantidad_requerida=2.0
        )
        
        # Create Operacion
        self.operacion = Operacion.objects.create(
            cliente=self.client,
            ship=self.ship,
            port=self.port,
            creado_por=self.owner,
            estado='solicitada'
        )
        # Detail requesting 15 units of finished product
        # Stock currently is 10, so there is a shortage of 5 units.
        self.detalle = OperacionDetalle.objects.create(
            operacion=self.operacion,
            articulo_id=self.prod_finished.id,
            cantidad=15,
            precio_unitario=10.0
        )
        
    def test_complete_workflow(self):
        # 1. Verify stock is insufficient
        # Call verificar_stock view endpoint
        url_verificar = f'/api/operaciones/operations/{self.operacion.id}/verificar_stock/'
        res = self.owner_client.get(url_verificar)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['todo_suficiente'])
        
        # 2. Operario role should not be able to generate or complete production orders
        url_generar = f'/api/operaciones/operations/{self.operacion.id}/generar_ordenes_produccion/'
        res = self.operario_client.post(url_generar)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        
        # 3. Generate production orders as Owner
        res = self.owner_client.post(url_generar)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['created_count'], 1)
        orden_id = res.data['ordenes'][0]['id']
        
        # Verify the production order is created with correct shortage quantity: 15 (requested) - 10 (available) = 5
        orden = OrdenFabricacion.objects.get(id=orden_id)
        self.assertEqual(orden.cantidad_a_producir, 5)
        self.assertFalse(orden.completada)
        
        # 4. Operario should not be able to complete production orders
        url_completar = f'/api/produccion/ordenes/{orden_id}/completar/'
        res = self.operario_client.post(url_completar)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        
        # 5. Complete production order as Owner (replenish stock)
        # Check initial stocks: Insumo = 100, Finished Product = 10
        # Formula: 1 unit of Product A requires 2 units of Raw Material B
        # To produce 5 units: consumes 10 units of Raw Material B. Insumo stock should become 90.
        # Finished Product A stock should become 15.
        res = self.owner_client.post(url_completar)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'completada')
        
        # Refresh articles from DB
        self.prod_finished.refresh_from_db()
        self.prod_insumo.refresh_from_db()
        self.assertEqual(self.prod_finished.stock_actual, 15.0)
        self.assertEqual(self.prod_insumo.stock_actual, 90.0)
        
        # Verify Movimientos Stock
        # Outflow for insumo (SALIDA)
        mov_insumo = MovimientoStock.objects.filter(articulo=self.prod_insumo, tipo='SALIDA').first()
        self.assertIsNotNone(mov_insumo)
        self.assertEqual(mov_insumo.cantidad, 10.0)
        
        # Inflow for finished product (INGRESO)
        mov_finished = MovimientoStock.objects.filter(articulo=self.prod_finished, tipo='INGRESO').first()
        self.assertIsNotNone(mov_finished)
        self.assertEqual(mov_finished.cantidad, 5.0)
        
        # 6. Verify stock is now sufficient for the operation
        res = self.owner_client.get(url_verificar)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['todo_suficiente'])
        
        # 7. Advance operation state to reached en_customs / en_aduana to consume stock
        # Initial: 'solicitada' -> confirm_operation -> 'armado_packing' -> start_coordination -> 'en_aduana' (consumes stock)
        url_confirm = f'/api/operaciones/operations/{self.operacion.id}/confirm_operation/'
        res = self.owner_client.post(url_confirm)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.operacion = Operacion.objects.get(id=self.operacion.id)
        self.assertEqual(self.operacion.estado, 'armado_packing')
        self.assertFalse(self.operacion.stock_consumido)
        
        # Add packing_list_file to allow start_coordination
        self.operacion.packing_list_file = SimpleUploadedFile("packing_list.pdf", b"dummy PDF data", content_type="application/pdf")
        self.operacion.save()
        
        url_send_to_customs = f'/api/operaciones/operations/{self.operacion.id}/start_coordination/'
        res = self.owner_client.post(url_send_to_customs)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.operacion = Operacion.objects.get(id=self.operacion.id)
        self.assertEqual(self.operacion.estado, 'en_aduana')
        self.assertTrue(self.operacion.stock_consumido)
        
        # Verify finished product stock consumed: 15 units of finished product should be deducted (SALIDA)
        self.prod_finished.refresh_from_db()
        self.assertEqual(self.prod_finished.stock_actual, 0.0)
        
        mov_consumption = MovimientoStock.objects.filter(articulo=self.prod_finished, tipo='SALIDA', operacion_id=self.operacion.id).first()
        self.assertIsNotNone(mov_consumption)
        self.assertEqual(mov_consumption.cantidad, 15.0)
        
        # 8. Cancel the operation as Owner, verifying that the stock is returned to inventory
        url_cancel = f'/api/operaciones/operations/{self.operacion.id}/cancel_operation/'
        res = self.owner_client.post(url_cancel)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.operacion = Operacion.objects.get(id=self.operacion.id)
        self.assertEqual(self.operacion.estado, 'cancelada')
        self.assertFalse(self.operacion.stock_consumido)
        
        # Stock of Finished Product A should return to 15.0
        self.prod_finished.refresh_from_db()
        self.assertEqual(self.prod_finished.stock_actual, 15.0)
        
        # There should be an INGRESO movement for the reversal
        mov_reversal = MovimientoStock.objects.filter(
            articulo=self.prod_finished,
            tipo='INGRESO',
            operacion_id=self.operacion.id,
            razon__icontains="devolución"
        ).first()
        self.assertIsNotNone(mov_reversal)
        self.assertEqual(mov_reversal.cantidad, 15.0)

    def test_controlar_stock_false(self):
        # Create an article with controlar_stock=False and 0 stock
        prod_insumo_no_control = Articulo.objects.create(
            nombre="Insumo Bajo Pedido",
            presentacion="Unidad",
            peso_kg=1.00,
            stock_actual=0.0,  # 0 stock!
            categoria="insumos",
            controlar_stock=False,
            proveedor=self.proveedor
        )
        
        # Add to operation details
        detalle_insumo = OperacionDetalle.objects.create(
            operacion=self.operacion,
            articulo_id=prod_insumo_no_control.id,
            cantidad=10,
            precio_unitario=5.0
        )
        
        # We need the other finished product to have sufficient stock first so it doesn't block
        self.prod_finished.stock_actual = 15.0
        self.prod_finished.save()
        
        # 1. Verify stock is sufficient despite insumo having 0 stock
        url_verificar = f'/api/operaciones/operations/{self.operacion.id}/verificar_stock/'
        res = self.owner_client.get(url_verificar)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['todo_suficiente'])
        
        # Verify the details return that insumo is "suficiente" and its controlar_stock is False
        details_map = {d['articulo_id']: d for d in res.data['detalles']}
        self.assertTrue(details_map[prod_insumo_no_control.id]['suficiente'])
        self.assertFalse(details_map[prod_insumo_no_control.id]['controlar_stock'])
        
        # 2. Advance operation state to reached en_customs / en_aduana
        url_confirm = f'/api/operaciones/operations/{self.operacion.id}/confirm_operation/'
        res = self.owner_client.post(url_confirm)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.operacion = Operacion.objects.get(pk=self.operacion.pk)
        self.operacion.packing_list_file = SimpleUploadedFile("packing_list.pdf", b"dummy PDF data", content_type="application/pdf")
        self.operacion.save()
        
        url_send_to_customs = f'/api/operaciones/operations/{self.operacion.id}/start_coordination/'
        res = self.owner_client.post(url_send_to_customs)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        
        # Refresh articles and check stocks
        prod_insumo_no_control.refresh_from_db()
        self.prod_finished.refresh_from_db()
        
        # Insumo stock should still be 0.0 (not decremented)
        self.assertEqual(prod_insumo_no_control.stock_actual, 0.0)
        # Finished product stock should be decremented to 0.0
        self.assertEqual(self.prod_finished.stock_actual, 0.0)
        
        # Verify no SALIDA movement was created for the non-controlled insumo
        mov_insumo = MovimientoStock.objects.filter(articulo=prod_insumo_no_control, operacion_id=self.operacion.id)
        self.assertEqual(mov_insumo.count(), 0)
        
        # Revert/Cancel the operation
        url_cancel = f'/api/operaciones/operations/{self.operacion.id}/cancel_operation/'
        res = self.owner_client.post(url_cancel)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Insumo stock should still be 0.0
        prod_insumo_no_control.refresh_from_db()
        self.assertEqual(prod_insumo_no_control.stock_actual, 0.0)

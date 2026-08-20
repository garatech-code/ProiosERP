import os
import tempfile
import subprocess
from datetime import datetime
import json
from django.conf import settings
from docxtpl import DocxTemplate

def get_template_path(lang):
    # Base folder for templates
    templates_dir = os.path.join(settings.BASE_DIR, 'apps', 'operaciones', 'templates')
    if lang == 'es':
        return os.path.join(templates_dir, 'Proios_Cotizacion_TEMPLATE_ES.docx')
    else:
        return os.path.join(templates_dir, 'Proios_Quotation_TEMPLATE_EN.docx')

def generar_cotizacion_docx_pdf(op, offer_validity, payment_terms, delivery_time, include_vat, scope_includes, scope_excludes, notes, attn, lang, custom_items, vat_percentage, user, service_forma_override=None, service_value_override=None, service_qty_override=None, service_unit_price_override=None):
    template_path = get_template_path(lang)
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"No se encontró la plantilla Word en {template_path}")

    tpl = DocxTemplate(template_path)
    
    # Preparamos los custom items
    import json
    try:
        if isinstance(custom_items, str):
            items_list = json.loads(custom_items)
        else:
            items_list = custom_items
    except:
        items_list = []
        
    # Unificamos los items para "scope_of_work" y "importe" de la primer tabla
    items_context = []
    if op.tipo_operacion == 'servicios':
        scope_of_work = op.detalle_servicio or "Descripción del servicio"
        
        # Override valor si existe, si no usa el de la base de datos
        if service_value_override:
            importe_total = float(service_value_override)
        else:
            importe_total = float(op.valor_servicio or 0)
            
        # Map forma de cotizacion to unit
        forma = service_forma_override if service_forma_override else op.forma_cotizacion_servicio
        
        cantidad_str = '1'
        precio_unit_str = f"{importe_total:,.2f}"
        
        if forma == 'hora_hombre':
            unidad = 'Hr'
            if service_qty_override and service_unit_price_override:
                cantidad_str = str(service_qty_override)
                precio_unit_str = f"{float(service_unit_price_override):,.2f}"
        elif forma == 'dias':
            unidad = 'Day' if lang == 'en' else 'Día'
            if service_qty_override and service_unit_price_override:
                cantidad_str = str(service_qty_override)
                precio_unit_str = f"{float(service_unit_price_override):,.2f}"
        else:
            unidad = 'LS'
            
        if items_list:
            for idx, item in enumerate(items_list):
                if idx == 0:
                    items_context.append({
                        'descripcion': item.get('nombre', ''),
                        'scope_of_work': item.get('nombre', ''),
                        'categoria': 'Service' if lang == 'en' else 'Servicio',
                        'cantidad': cantidad_str,
                        'unidad': unidad,
                        'precio': precio_unit_str,
                        'importe': f"{importe_total:,.2f}"
                    })
                else:
                    items_context.append({
                        'descripcion': item.get('nombre', ''),
                        'scope_of_work': item.get('nombre', ''),
                        'categoria': '',
                        'cantidad': '',
                        'unidad': '',
                        'precio': '',
                        'importe': ''
                    })
        else:
            items_context.append({
                'descripcion': scope_of_work,
                'scope_of_work': scope_of_work, # Alias para templates antiguos
                'categoria': 'Service' if lang == 'en' else 'Servicio',
                'cantidad': cantidad_str,
                'unidad': unidad,
                'precio': precio_unit_str,
                'importe': f"{importe_total:,.2f}"
            })
    else:
        scope_lines = []
        importe_total = 0.0
        for item in items_list:
            desc = item.get('nombre', '')
            cant = float(item.get('cantidad') or 1)
            precio = float(item.get('precio_unitario') or 0)
            subtotal = cant * precio
            scope_lines.append(f"{desc} (x{cant})")
            importe_total += subtotal
            items_context.append({
                'descripcion': desc,
                'categoria': 'Product' if lang == 'en' else 'Producto',
                'cantidad': cant,
                'unidad': 'u',
                'precio': f"{precio:,.2f}",
                'importe': f"{subtotal:,.2f}"
            })
            
        scope_of_work = "\n".join(scope_lines) if scope_lines else "Provisión de repuestos/productos"

    if include_vat:
        iva = importe_total * (float(vat_percentage) / 100.0)
    else:
        iva = 0.0
        
    total = importe_total + iva
    
    # Preparar el contexto
    context = {
        'items': items_context,
        'validez': offer_validity,
        'forma_de_pago': payment_terms,
        'tiempo_entrega': delivery_time,
        'garantia': "N/A",  # No tenemos campo garantía explícito aún
        'scope_includes': scope_includes,
        'scope_excludes': scope_excludes,
        'lugar_entrega': "N/A", 
        'medida': "",
        'atencion': (op.cliente.contact_person if (op.cliente and hasattr(op.cliente, 'contact_person') and op.cliente.contact_person) else (op.cliente.name if op.cliente else "")),
        'ref': "", 
        'iva': f"{iva:,.2f}",
        'impuestos': "VAT" if lang == 'en' else "IVA",
        'moneda': "USD",
        'fecha': datetime.now().strftime('%d/%m/%Y'),
        'cargo': "Operations" if lang == 'en' else "Operaciones",
        'scope_of_work': scope_of_work,
        'importe': f"{importe_total:,.2f}",
        'total': f"{total:,.2f}",
        'buque': op.ship.name if op.ship else "",
        'cliente': op.cliente.name if op.cliente else "",
        'eta': op.eta.strftime('%d/%m/%Y') if op.eta else "",
        'ubicacion': "",
        'firmante_email': user.email if user else "operations@proios.com",
        'firmante': user.get_full_name() if user else "Proios Team",
        'danos': [],  # Lista vacía para que docxtpl elimine la tabla de daños
    }
    
    tpl.render(context)
    
    # Guardar DOCX temporalmente
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_docx_path = os.path.join(temp_dir, 'cotizacion_temp.docx')
        tpl.save(temp_docx_path)
        
        # Convertir a PDF con LibreOffice
        # libreoffice --headless --convert-to pdf cotizacion_temp.docx --outdir /tmp
        try:
            subprocess.run([
                'libreoffice',
                '--headless',
                '--convert-to', 'pdf',
                temp_docx_path,
                '--outdir', temp_dir
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except FileNotFoundError:
            raise RuntimeError("LibreOffice no está instalado o no se encuentra en el PATH. No se puede convertir a PDF.")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Error al convertir DOCX a PDF: {e.stderr.decode()}")
            
        temp_pdf_path = os.path.join(temp_dir, 'cotizacion_temp.pdf')
        if not os.path.exists(temp_pdf_path):
            raise RuntimeError("La conversión a PDF falló silenciosamente.")
            
        with open(temp_pdf_path, 'rb') as f:
            pdf_bytes = f.read()
            
    return pdf_bytes

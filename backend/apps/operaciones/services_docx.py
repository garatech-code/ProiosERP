import os
import tempfile
import subprocess
from datetime import datetime
import json
from django.conf import settings
from docxtpl import DocxTemplate

def format_unit(u_val, lang):
    u_val = str(u_val).strip() if u_val else 'u'
    if u_val == 'u':
        return 'Unit' if lang == 'en' else 'Ud.'
    if u_val == 'par':
        return 'Pair' if lang == 'en' else 'Par'
    return u_val

def get_template_path(lang, tipo_operacion):
    # Base folder for templates
    templates_dir = os.path.join(settings.BASE_DIR, 'apps', 'operaciones', 'templates')
    
    # Capitalize the first letter (servicios -> Servicios, productos -> Productos, etc.)
    tipo = tipo_operacion.capitalize() if tipo_operacion else "Productos"
    
    # Mapeo de tipos, si es 'Otros' usamos Productos por defecto
    if tipo not in ["Servicios", "Productos", "Quimicos"]:
        tipo = "Productos"
        
    if lang == 'es':
        return os.path.join(templates_dir, f'Proios_Cotizacion_{tipo}_TEMPLATE_ES.docx')
    else:
        return os.path.join(templates_dir, f'Proios_Quotation_{tipo}_TEMPLATE_EN.docx')

def generar_cotizacion_docx_pdf(op, offer_validity, payment_terms, delivery_time, include_vat, scope_includes, scope_excludes, notes, attn, lang, custom_items, vat_percentage, user, service_forma_override=None, service_value_override=None, service_qty_override=None, service_unit_price_override=None, ubicacion='', otros_gastos='', expensas='[]', lugar_entrega='FOB'):
    if isinstance(notes, str) and '{{notas}}' in notes:
        notes = notes.replace('{{notas}}', op.texto_cotizacion_adicional or 'N/A')
    
    template_path = get_template_path(lang, op.tipo_operacion)
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
        from apps.inventario.models import Articulo
        
        for detalle in op.detalles.all():
            try:
                articulo = Articulo.objects.get(id=detalle.articulo_id)
                desc = (articulo.nombre_en if getattr(articulo, 'nombre_en', None) else articulo.nombre) if lang == 'en' else articulo.nombre
                item_unidad = format_unit(articulo.unidad, lang)
            except Articulo.DoesNotExist:
                desc = f"Item {detalle.articulo_id}"
                item_unidad = format_unit("u", lang)
                
            cant = float(detalle.cantidad or 1)
            precio = float(detalle.precio_unitario or 0)
            subtotal = cant * precio
            scope_lines.append(f"{desc} (x{cant})")
            importe_total += subtotal
            
            items_context.append({
                'descripcion': desc,
                'scope_of_work': desc,
                'categoria': 'Product' if lang == 'en' else 'Producto',
                'cantidad': cant,
                'unidad': item_unidad,
                'precio': f"{precio:,.2f}",
                'importe': f"{subtotal:,.2f}"
            })
            
        scope_of_work = "\n".join(scope_lines) if scope_lines else "Provisión de repuestos/productos"

    if include_vat:
        iva = importe_total * (float(vat_percentage) / 100.0)
        impuestos_label = "VAT" if lang == 'en' else "IVA"
    else:
        iva = 0.0
        impuestos_label = "N/A"
        
    import re
    def parse_exp(val):
        if not val:
            return 0.0
        val_str = str(val).strip()
        try:
            return float(val_str)
        except ValueError:
            clean_str = val_str.replace(',', '')
            match = re.search(r'[-+]?\d*\.\d+|\d+', clean_str)
            if match:
                return float(match.group())
            return 0.0

    # Procesar arreglo dinámico de expensas
    import json
    try:
        expensas_list = json.loads(expensas) if isinstance(expensas, str) else expensas
    except:
        expensas_list = []

    expensas_context = []
    total_expensas = 0.0

    for exp in expensas_list:
        desc = exp.get('descripcion', '')
        # Reemplazar ubicacion
        if '{{ubicacion}}' in desc:
            desc = desc.replace('{{ubicacion}}', ubicacion)
        
        precio_val = parse_exp(exp.get('precio', '0'))
        cant_val = parse_exp(exp.get('cantidad', '1'))
        if cant_val == 0.0:
            cant_val = 1.0
            
        importe_exp = precio_val * cant_val
        
        expensas_context.append({
            'descripcion': desc,
            'cantidad': str(int(cant_val) if cant_val.is_integer() else cant_val),
            'unidad': exp.get('unidad', ''),
            'precio': f"{precio_val:,.2f}" if precio_val else "",
            'importe': f"{importe_exp:,.2f}" if importe_exp else ""
        })
        total_expensas += importe_exp

    val_otros_gastos = parse_exp(otros_gastos)
    total_expensas += val_otros_gastos

    total = importe_total + iva + total_expensas

    clean_notes = notes if notes and notes.strip() not in ['[Other relevant note]', '[Otra nota relevante]', 'N/A'] else ''

    # Preparar el contexto
    context = {
        'items': items_context,
        'validez': offer_validity,
        'forma_de_pago': payment_terms,
        'tiempo_entrega': delivery_time,
        'garantia': "N/A",  # No tenemos campo garantía explícito aún
        'scope_includes': scope_includes,
        'scope_excludes': scope_excludes,
        'notes': clean_notes,
        'notas': clean_notes,
        'lugar_entrega': lugar_entrega,  
        'medida': "",
        'atencion': (op.cliente.contact_person if (op.cliente and hasattr(op.cliente, 'contact_person') and op.cliente.contact_person) else (op.cliente.name if op.cliente else "")),
        'ref': f"OP-{op.id:04d}", 
        'iva': f"{iva:,.2f}" if include_vat else "0.00",
        'impuestos': impuestos_label,
        'moneda': "USD",
        'fecha': datetime.now().strftime('%d/%m/%Y'),
        'cargo': "Operations" if lang == 'en' else "Operaciones",
        'scope_of_work': scope_of_work,
        'importe': f"{importe_total:,.2f}",
        'total': f"{total:,.2f}",
        'buque': op.ship.name if op.ship else "",
        'cliente': op.cliente.name if op.cliente else "",
        'eta': op.eta.strftime('%d/%m/%Y') if op.eta else "",
        'ubicacion': ubicacion,
        'otros_gastos': otros_gastos,
        'exp2': otros_gastos,  # Alias por compatibilidad
        'expensas': expensas_context,
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

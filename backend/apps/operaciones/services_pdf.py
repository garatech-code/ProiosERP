import io
import os
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

try:
    tahoma_path = os.path.join(settings.BASE_DIR, 'static_local', 'fonts', 'tahoma.ttf')
    tahomabd_path = os.path.join(settings.BASE_DIR, 'static_local', 'fonts', 'tahomabd.ttf')
    if os.path.exists(tahoma_path) and os.path.exists(tahomabd_path):
        pdfmetrics.registerFont(TTFont('Tahoma', tahoma_path))
        pdfmetrics.registerFont(TTFont('Tahoma-Bold', tahomabd_path))
        pdfmetrics.registerFont(TTFont('Tahoma-Oblique', tahoma_path)) # Fallback to normal for oblique
        DEFAULT_FONT = 'Tahoma'
        DEFAULT_FONT_BOLD = 'Tahoma-Bold'
        DEFAULT_FONT_OBLIQUE = 'Tahoma-Oblique'
        
        from reportlab.lib.fonts import addMapping
        addMapping('Tahoma', 0, 0, 'Tahoma')
        addMapping('Tahoma', 1, 0, 'Tahoma-Bold')
        addMapping('Tahoma', 0, 1, 'Tahoma-Oblique')
        addMapping('Tahoma', 1, 1, 'Tahoma-Oblique')
    else:
        DEFAULT_FONT = 'Helvetica'
        DEFAULT_FONT_BOLD = 'Helvetica-Bold'
        DEFAULT_FONT_OBLIQUE = 'Helvetica-Oblique'
except Exception:
    DEFAULT_FONT = 'Helvetica'
    DEFAULT_FONT_BOLD = 'Helvetica-Bold'
    DEFAULT_FONT_OBLIQUE = 'Helvetica-Oblique'

def get_logo():
    logo_path = os.path.join(settings.BASE_DIR, 'static_local', 'logo.png')
    if os.path.exists(logo_path):
        return logo_path
    return None

def build_pdf_headers(doc, story, operacion, title):
    styles = getSampleStyleSheet()
    title_style = styles['Title']
    normal_style = styles['Normal']
    
    # Agregar logo si existe
    # logo_path = get_logo()
    # if logo_path:
    #     img = RLImage(logo_path, width=4*cm, height=2*cm, kind='proportional')
    #     story.append(img)
    
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Info de operación
    info = [
        [Paragraph('<b>Operación ID:</b>', normal_style), f"OP-{operacion.id:05d}"],
        [Paragraph('<b>Cliente:</b>', normal_style), operacion.cliente.name if operacion.cliente else ''],
        [Paragraph('<b>Buque:</b>', normal_style), operacion.ship.name if operacion.ship else ''],
        [Paragraph('<b>Puerto:</b>', normal_style), operacion.port.name if operacion.port else ''],
    ]
    t = Table(info, colWidths=[4*cm, 10*cm])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 1*cm))
    return story

def generar_cotizacion_servicio_pdf(operacion, user, params):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    normal_style = styles['Normal']
    normal_style.fontSize = 11
    normal_style.leading = 14
    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD)
    italic_style = ParagraphStyle('ItalicStyle', parent=normal_style, fontName=DEFAULT_FONT_OBLIQUE)
    heading_style = ParagraphStyle('Heading', parent=normal_style, fontName=DEFAULT_FONT_BOLD, fontSize=12, spaceAfter=6, spaceBefore=12)
    bullet_style = ParagraphStyle('Bullet', parent=normal_style, leftIndent=20, bulletIndent=10)

    # Header Logo
    # logo_path = get_logo()
    # if logo_path:
    #     img = RLImage(logo_path, width=5*cm, height=2.5*cm, kind='proportional')
    #     # Center the logo using a table
    #     t_logo = Table([[img]], colWidths=[17*cm])
    #     t_logo.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    #     story.append(t_logo)
    
    story.append(Spacer(1, 1*cm))
    
    # Salutation
    cliente_nombre = operacion.cliente.name if operacion.cliente else "Client"
    story.append(Paragraph(f"Dear {cliente_nombre},", normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Introduction
    intro_text = operacion.detalle_servicio or "Please note below our quotation for the requested services."
    story.append(Paragraph(intro_text.replace('\n', '<br/>'), normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    # 1. Items
    story.append(Paragraph("<b>1. Items:</b>", bold_style))
    
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    items_data = []
    
    total = 0
    from apps.inventario.models import Articulo
    for i, det in enumerate(operacion.detalles.all()):
        letra = alphabet[i] if i < len(alphabet) else str(i+1)
        try:
            articulo = Articulo.objects.get(id=det.articulo_id)
            nombre_item = articulo.nombre
        except Articulo.DoesNotExist:
            nombre_item = f"Item #{det.articulo_id}"
        precio_item = det.precio_unitario * det.cantidad
        total += precio_item
        texto_item = f"<b>{letra}.</b> {nombre_item} ({det.cantidad} un): <b>USD {precio_item:,.2f}</b> + taxes."
        story.append(Paragraph(texto_item, bullet_style))
    
    story.append(Spacer(1, 0.5*cm))
    
    # Timings
    if params.get('mobilization'):
        story.append(Paragraph(f"<u>Estimated time for mobilization: {params['mobilization']}</u>", italic_style))
    if params.get('execution'):
        story.append(Paragraph(f"<u>Estimated time for the execution: {params['execution']}</u>", italic_style))
        
    story.append(Spacer(1, 0.5*cm))
    
    # Notes / Additional Text (e.g. asterisks)
    if operacion.texto_cotizacion_adicional:
        # Reemplazar flechas si el usuario usa -> por la flecha del PDF
        notas = operacion.texto_cotizacion_adicional.replace('->', '➔')
        story.append(Paragraph(notas.replace('\n', '<br/>'), normal_style))
        story.append(Spacer(1, 0.5*cm))
        
    # 2. Administrative
    story.append(Paragraph("<b>2. Administrative:</b>", bold_style))
    if params.get('bank_charges'):
        story.append(Paragraph(f"• Bank charges: {params['bank_charges']}", bullet_style))
    if params.get('taxes'):
        story.append(Paragraph(f"• Taxes {params['taxes']}", bullet_style))
    if params.get('payment_terms'):
        story.append(Paragraph(f"• Payment terms: {params['payment_terms']}", bullet_style))
        
    story.append(Spacer(1, 0.5*cm))
    
    # 3. Remarks
    story.append(Paragraph("<b>3. Remarks:</b>", bold_style))
    remark_1 = "<b><u>The final invoice may vary depending on actual service duration, onboard conditions, and any extra time or resources required.</u></b>"
    story.append(Paragraph(f"• {remark_1}", bullet_style))
    
    if params.get('transport'):
        remark_2 = f"<b><u>{params['transport']}</u></b>"
        story.append(Paragraph(f"• {remark_2}", bullet_style))
        
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("Please check and advise.", normal_style))
    story.append(Spacer(1, 1.5*cm))
    
    # Signature
    story.append(Paragraph("Best regards,", normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    user_name = f"{user.first_name} {user.last_name}".strip() if user and (user.first_name or user.last_name) else (user.username if user else "Proios Representative")
    user_email = "operations@proios.com"
    
    firma_data = [
        [Paragraph(f"<b>{user_name}</b><br/>Comercial / Operations<br/>{user_email}", normal_style)]
    ]
    t_firma = Table(firma_data, colWidths=[10*cm])
    t_firma.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_firma)
    
    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf

def generar_permiso_pna_pdf(operacion, tipo_trabajo):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    story = []
    styles = getSampleStyleSheet()
    
    titulo = "Solicitud de Permiso PNA - Trabajo en Caliente" if tipo_trabajo == 'caliente' else "Solicitud de Permiso PNA - Trabajo en Frío"
    story = build_pdf_headers(doc, story, operacion, titulo)
    
    story.append(Paragraph("A la Prefectura Naval Argentina,", styles['Normal']))
    story.append(Spacer(1, 0.5*cm))
    
    if operacion.texto_permiso_pna:
        texto_permiso = operacion.texto_permiso_pna.replace('\n', '<br/>')
    else:
        texto_permiso = f"""
        Por medio de la presente solicitamos el permiso correspondiente para realizar tareas de 
        <b>{titulo.split('- ')[1]}</b> a bordo del buque <b>{operacion.ship.name if operacion.ship else 'N/A'}</b>.
        <br/><br/>
        La operación estará a cargo de nuestro personal especializado y se cumplirán todas las normativas de seguridad correspondientes.
        """
    story.append(Paragraph(texto_permiso, styles['Normal']))
    
    story.append(Spacer(1, 4*cm))
    story.append(Paragraph("_____________________________", styles['Normal']))
    story.append(Paragraph("Firma Responsable Proios", styles['Normal']))
    
    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf

def generar_solicitud_particular_pdf(operacion):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    story = []
    styles = getSampleStyleSheet()
    
    story = build_pdf_headers(doc, story, operacion, "Solicitud Particular (Herramientas a bordo)")
    
    texto = """
    A continuación se detalla el listado de herramientas y equipos que serán ingresados a bordo para la ejecución 
    del servicio, los cuales serán retirados una vez finalizadas las tareas:
    """
    story.append(Paragraph(texto, styles['Normal']))
    story.append(Spacer(1, 1*cm))
    
    # Parsear herramientas_solicitud_particular (puede ser JSON o texto plano viejo)
    import json
    herramientas = []
    if operacion.herramientas_solicitud_particular:
        try:
            # Intentar parsear como JSON
            parsed = json.loads(operacion.herramientas_solicitud_particular)
            if isinstance(parsed, list):
                herramientas = parsed
            else:
                raise ValueError("No es una lista")
        except Exception:
            # Si falla, tratar como texto plano separado por líneas
            lineas = [h.strip() for h in operacion.herramientas_solicitud_particular.split('\n') if h.strip()]
            herramientas = [{'descripcion': h, 'cantidad': 1, 'serie': ''} for h in lineas]
    
    data = [['Ítem', 'Descripción de Herramienta/Equipo', 'Cant.', 'Nº Serie']]
    
    if herramientas:
        for i, h in enumerate(herramientas, 1):
            desc = h.get('descripcion', '')
            cant = str(h.get('cantidad', ''))
            serie = h.get('serie', '')
            data.append([str(i), Paragraph(desc, styles['Normal']), cant, serie])
    else:
        for i in range(1, 10):
            data.append([str(i), '', '', ''])
        
    t = Table(data, colWidths=[1.5*cm, 9*cm, 1.5*cm, 4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#002b5e')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), DEFAULT_FONT_BOLD),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.whitesmoke, colors.white]),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.black),
        ('BOX', (0,0), (-1,-1), 0.25, colors.black),
        ('BOTTOMPADDING', (0,1), (-1,-1), 10),
    ]))
    story.append(t)
    
    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf

def generar_reporte_servicio_pdf(operacion):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    story = []
    styles = getSampleStyleSheet()
    
    story = build_pdf_headers(doc, story, operacion, "Reporte de Servicio (Service Report)")
    
    # Detalle de tareas realizadas
    story.append(Paragraph("<b>Tareas Realizadas:</b>", styles['Heading3']))
    detalle = operacion.detalle_servicio or "Detalle las tareas realizadas aquí."
    story.append(Paragraph(detalle.replace('\n', '<br/>'), styles['Normal']))
    story.append(Spacer(1, 0.5*cm))
    
    # Firmas
    t = Table([['_________________________', '_________________________'], 
               ['Firma Cliente / Sello', 'Firma Responsable Proios']],
               colWidths=[7*cm, 7*cm])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t)
    
    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
import io
from datetime import datetime

def generar_cotizacion_pdf_nativa(operacion, offer_validity="15 days", payment_terms="30 days from invoice date", delivery_time="5", include_vat=True, scope_includes="[detail what the supply / service comprises]", scope_excludes="[freight, customs clearance, additional labour, parts not listed, etc.]", notes="[Other relevant note]", attn="Operations / Technical Department", lang="en", damage_location="", damage_frames="", damage_area="", custom_items="[]", damage_subject="DAMAGE DESCRIPTION", damage_location_title="Location and damage", damage_frames_title="Frame(s)", damage_area_title="Area L x H (mm)", vat_percentage="21", user=None):
    import os
    import io
    from datetime import datetime
    from django.conf import settings
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
    from reportlab.lib.colors import HexColor, Color
    card_bg = Color(248/255.0, 250/255.0, 252/255.0, alpha=0.4)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
    from reportlab.lib.units import cm
    from reportlab.lib.pagesizes import A4
    
    buffer = io.BytesIO()
    # Margins: A4 is 21cm x 29.7cm.
    # Left/Right 1.5cm = 18cm content width.
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=3*cm)
    story = []
    
    styles = getSampleStyleSheet()
    normal_style = styles['Normal']
    normal_style.fontSize = 9
    normal_style.leading = 13
    normal_style.textColor = HexColor('#1e293b') # Dark slate instead of pure black
    normal_style.fontName = DEFAULT_FONT
    
    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD)
    
    title_style = ParagraphStyle('TitleStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD, fontSize=28, leading=32, textColor=HexColor('#003366'), alignment=TA_LEFT, spaceAfter=0)
    
    card_title_style = ParagraphStyle('CardTitle', parent=bold_style, fontSize=8, textColor=HexColor('#64748b'), spaceAfter=6, textTransform='uppercase')
    
    # --- 1. HEADER (TITLE & LOGO) ---
    logo_path = os.path.join(settings.BASE_DIR, 'static_local', 'logo.png')
    logo_img = ""
    if os.path.exists(logo_path):
        logo_img = Image(logo_path, width=4.5*cm, height=4.5*cm, kind='proportional')
        
    header_top = Table([
        [Paragraph("QUOTATION", title_style), logo_img]
    ], colWidths=[13*cm, 5*cm])
    header_top.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(header_top)
    story.append(Spacer(1, 0.5*cm))
    
    # --- 2. HEADER CARDS (FROM / TO / DETAILS) ---
    buque = operacion.ship.name if operacion.ship else "[Vessel Name]"
    puerto = operacion.port.name if operacion.port else "[Port]"
    eta_str = operacion.eta.strftime("%d/%m/%Y") if operacion.eta else "[ETA]"
    cliente_nombre = operacion.cliente.name if operacion.cliente else "[Client Name]"
    current_date = datetime.now().strftime('%d %b %Y')
    
    from_html = "<b>Proios S.A.</b><br/>Comodoro Pedro Zanni<br/>351 floor 5th 503 LN.<br/>Buenos Aires (C1104AAH)<br/>Argentina<br/><br/><font color='#64748b'>Email:</font> operations@proios.com"
    to_html = f"<b>{cliente_nombre}</b><br/><br/><br/><font color='#64748b'>Attn:</font><br/>{attn}"
    details_html = f"<b>No. PS-COT-{operacion.id:04d}</b><br/>Date: {current_date}<br/>Valid: {offer_validity}<br/><br/>Vessel: <b>{buque}</b><br/>Port: {puerto}<br/>ETA: {eta_str}"
    
    card_from = [Paragraph("FROM", card_title_style), Paragraph(from_html, normal_style)]
    card_to = [Paragraph("TO", card_title_style), Paragraph(to_html, normal_style)]
    card_details = [Paragraph("DETAILS", card_title_style), Paragraph(details_html, normal_style)]
    
    # 18cm total width = 5.6cm + 0.6cm + 5.6cm + 0.6cm + 5.6cm
    cards_table = Table([
        [card_from, "", card_to, "", card_details]
    ], colWidths=[5.6*cm, 0.6*cm, 5.6*cm, 0.6*cm, 5.6*cm])
    
    cards_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        # Card 1
        ('BACKGROUND', (0,0), (0,0), card_bg),
        ('BOX', (0,0), (0,0), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (0,0), 6), ('BOTTOMPADDING', (0,0), (0,0), 6),
        ('LEFTPADDING', (0,0), (0,0), 12), ('RIGHTPADDING', (0,0), (0,0), 12),
        # Card 2
        ('BACKGROUND', (2,0), (2,0), card_bg),
        ('BOX', (2,0), (2,0), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (2,0), (2,0), 6), ('BOTTOMPADDING', (2,0), (2,0), 6),
        ('LEFTPADDING', (2,0), (2,0), 12), ('RIGHTPADDING', (2,0), (2,0), 12),
        # Card 3
        ('BACKGROUND', (4,0), (4,0), card_bg),
        ('BOX', (4,0), (4,0), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (4,0), (4,0), 6), ('BOTTOMPADDING', (4,0), (4,0), 6),
        ('LEFTPADDING', (4,0), (4,0), 12), ('RIGHTPADDING', (4,0), (4,0), 12),
    ]))
    story.append(cards_table)
    story.append(Spacer(1, 1*cm))
    
    from apps.inventario.models import Articulo
    import json
    
    grupos = {}
    detalles = list(operacion.detalles.all())
    for det in detalles:
        try:
            articulo = Articulo.objects.get(id=det.articulo_id)
            cat = str(articulo.categoria).strip() if articulo.categoria and str(articulo.categoria).strip() else "GENERAL"
            desc = articulo.nombre
            unit = str(articulo.unidad) if articulo.unidad else "u"
        except Articulo.DoesNotExist:
            cat = "GENERAL"
            desc = f"Item #{det.articulo_id}"
            unit = "u"

        cat = cat.upper()
        if cat not in grupos:
            grupos[cat] = []
        grupos[cat].append({
            'desc': desc,
            'qty': float(det.cantidad),
            'unit': unit,
            'price': float(det.precio_unitario) if det.precio_unitario else 0.0
        })

    try:
        if isinstance(custom_items, str):
            custom_items_list = json.loads(custom_items)
        else:
            custom_items_list = custom_items
            
        print(f"DEBUG custom_items parsed: {custom_items_list}")
            
        if isinstance(custom_items_list, list):
            if 'SERVICES' not in grupos:
                grupos['SERVICES'] = []
            for c_item in custom_items_list:
                qty = c_item.get('cantidad', 1)
                if not qty or str(qty).strip() == '': qty = 1
                price = c_item.get('precio_unitario', 0)
                if not price or str(price).strip() == '': price = 0
                
                qty = float(qty)
                price = float(price)
                grupos['SERVICES'].append({
                    'desc': c_item.get('nombre', ''),
                    'qty': qty,
                    'unit': 'UN',
                    'price': price,
                    'amount': qty * price
                })
        print(f"DEBUG grupos after custom items: {grupos}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DEBUG ERROR custom_items: {e}")

    has_items = sum(len(items) for items in grupos.values()) > 0
    total_general = 0

    # --- 3. ITEMS INTRO ---
    tipo_mapped = "products"
    if operacion.tipo_operacion == 'quimicos': tipo_mapped = "chemicals"
    elif operacion.tipo_operacion == 'servicios': tipo_mapped = "services"
    elif operacion.tipo_operacion == 'otros': tipo_mapped = "spare parts"
    
    intro_style = ParagraphStyle('Intro', parent=normal_style, fontSize=10, textColor=HexColor('#334155'))
    story.append(Paragraph(f"We are pleased to submit our quotation for the supply of <b>{tipo_mapped}</b>, as detailed below:", intro_style))
    story.append(Spacer(1, 0.5*cm))
    
    # --- 4. ITEMS TABLE (MODERN EDITORIAL) ---
    th_style = ParagraphStyle('TH', parent=bold_style, textColor=colors.white, fontSize=9)
    th_right = ParagraphStyle('THR', parent=th_style, alignment=TA_RIGHT)
    th_center = ParagraphStyle('THC', parent=th_style, alignment=TA_CENTER)
    
    table_data = []
    table_data.append([
        Paragraph("No.", th_center),
        Paragraph("Description", th_style),
        Paragraph("Qty", th_center),
        Paragraph("Unit", th_center),
        Paragraph("Unit price (USD)", th_right),
        Paragraph("Amount (USD)", th_right)
    ])
    
    from apps.inventario.models import Articulo
    grupos = {}
    detalles = list(operacion.detalles.all())
    for det in detalles:
        try:
            articulo = Articulo.objects.get(id=det.articulo_id)
            cat = str(articulo.categoria).strip() if articulo.categoria and str(articulo.categoria).strip() else "GENERAL"
            desc = articulo.nombre
            unit = str(articulo.unidad) if articulo.unidad else "u"
        except Articulo.DoesNotExist:
            cat = "GENERAL"
            desc = f"Item #{det.articulo_id}"
            unit = "u"
            
        cat = cat.upper()
        if cat not in grupos:
            grupos[cat] = []
        grupos[cat].append({
            'desc': desc,
            'qty': float(det.cantidad),
            'unit': unit,
            'price': float(det.precio_unitario) if det.precio_unitario else 0.0
        })
        
    total_general = 0
    idx = 1
    
    tr_style = ParagraphStyle('TR', parent=normal_style)
    tr_right = ParagraphStyle('TRR', parent=tr_style, alignment=TA_RIGHT)
    tr_center = ParagraphStyle('TRC', parent=tr_style, alignment=TA_CENTER)
    
    for cat_name, items in grupos.items():
        table_data.append([Paragraph(f"<b>{cat_name}</b>", ParagraphStyle('Cat', parent=bold_style, textColor=HexColor('#003366'))), "", "", "", "", ""])
        subtotal_cat = 0
        for item in items:
            qty = item['qty']
            price = item['price']
            sub = qty * price
            subtotal_cat += sub
            total_general += sub
            
            table_data.append([
                Paragraph(str(idx), tr_center),
                Paragraph(item['desc'], tr_style),
                Paragraph(str(int(qty) if qty.is_integer() else qty), tr_center),
                Paragraph(item['unit'], tr_center),
                Paragraph(f"{price:,.2f}", tr_right),
                Paragraph(f"{sub:,.2f}", tr_right)
            ])
            idx += 1
            
        table_data.append([
            Paragraph(f"Subtotal {cat_name.lower()}", ParagraphStyle('SubCat', parent=normal_style, textColor=HexColor('#64748b'))),
            "", "", "", "",
            Paragraph(f"<b>{subtotal_cat:,.2f}</b>", ParagraphStyle('SubCatR', parent=bold_style, alignment=TA_RIGHT))
        ])

    # 18cm total width
    col_widths = [1.2*cm, 7.8*cm, 1.5*cm, 1.5*cm, 2.8*cm, 3.2*cm]
    t = Table(table_data, colWidths=col_widths)
    
    ts = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#003366')), # Header blue
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('TOPPADDING', (0,0), (-1,0), 8),
    ])
    
    row_idx = 1
    for cat_name, items in grupos.items():
        # Category header
        ts.add('BACKGROUND', (0, row_idx), (-1, row_idx), HexColor('#f1f5f9'))
        ts.add('SPAN', (0, row_idx), (-1, row_idx))
        ts.add('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 6)
        ts.add('TOPPADDING', (0, row_idx), (-1, row_idx), 6)
        row_idx += 1
        
        # Items
        for _ in items:
            ts.add('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 8)
            ts.add('TOPPADDING', (0, row_idx), (-1, row_idx), 8)
            ts.add('LINEBELOW', (0, row_idx), (-1, row_idx), 0.5, HexColor('#e2e8f0'))
            row_idx += 1
            
        # Subtotal
        ts.add('SPAN', (0, row_idx), (4, row_idx))
        ts.add('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 8)
        ts.add('TOPPADDING', (0, row_idx), (-1, row_idx), 8)
        row_idx += 1

    t.setStyle(ts)
    story.append(t)
    story.append(Spacer(1, 0.8*cm))
    
    # --- 5. TOTALS PANEL (FINANCIAL HIGHLIGHT) ---
    # We want a card-like total block aligned to the right.
    tot_label_style = ParagraphStyle('TotL', parent=normal_style, alignment=TA_RIGHT, textColor=HexColor('#475569'))
    tot_val_style = ParagraphStyle('TotV', parent=normal_style, alignment=TA_RIGHT)
    tot_final_label = ParagraphStyle('TotFL', parent=bold_style, alignment=TA_RIGHT, fontSize=12, textColor=HexColor('#003366'))
    tot_final_val = ParagraphStyle('TotFV', parent=bold_style, alignment=TA_RIGHT, fontSize=14, textColor=HexColor('#003366'))
    
    if str(include_vat).lower() == 'true' or include_vat is True:
        tot_data = [
            [Paragraph("Subtotal:", tot_label_style), Paragraph(f"USD {total_general:,.2f}", tot_val_style)],
            [Paragraph("VAT (21%):", tot_label_style), Paragraph(f"USD {(float(total_general) * 0.21):,.2f}", tot_val_style)],
            [Paragraph("TOTAL USD:", tot_final_label), Paragraph(f"USD {(float(total_general) * 1.21):,.2f}", tot_final_val)]
        ]
    else:
        tot_data = [
            [Paragraph("TOTAL USD:", tot_final_label), Paragraph(f"USD {float(total_general):,.2f}", tot_final_val)]
        ]

    # Create an inner table for the numbers, then put it in a master table to align it right.
    t_tot_inner = Table(tot_data, colWidths=[3.5*cm, 4*cm])
    t_tot_inner.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-2), 4),
        ('TOPPADDING', (0,0), (-1,-2), 4),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 10),
        ('TOPPADDING', (0,-1), (-1,-1), 10),
        ('LINEABOVE', (0,-1), (-1,-1), 1, HexColor('#cbd5e1')),
    ]))
    
    # Wrap in a card
    t_tot_outer = Table([
        ["", t_tot_inner]
    ], colWidths=[10*cm, 8*cm])
    
    t_tot_outer.setStyle(TableStyle([
        ('BACKGROUND', (1,0), (1,0), card_bg),
        ('BOX', (1,0), (1,0), 1, HexColor('#003366')),
        # Left border extra thick for styling
        ('LINEBEFORE', (1,0), (1,0), 4, HexColor('#003366')),
        ('LEFTPADDING', (1,0), (1,0), 10),
        ('RIGHTPADDING', (1,0), (1,0), 10),
        ('TOPPADDING', (1,0), (1,0), 10),
        ('BOTTOMPADDING', (1,0), (1,0), 10),
    ]))
    
    story.append(t_tot_outer)
    story.append(Spacer(1, 1*cm))
    
    # --- 6. PAGE 2: TWO COLUMN LAYOUT ---
    h_style = ParagraphStyle('HStyle', parent=bold_style, fontSize=12, textColor=HexColor('#003366'), spaceAfter=12)
    
    # Left Column: SCOPE & NOTES
    left_col = []
    
    has_includes = scope_includes and str(scope_includes).strip() and not str(scope_includes).startswith('[detail') and not str(scope_includes).startswith('[detallar')
    has_excludes = scope_excludes and str(scope_excludes).strip() and not str(scope_excludes).startswith('[freight') and not str(scope_excludes).startswith('[fletes')
    
    if has_includes or has_excludes:
        left_col.append(Paragraph("SCOPE OF SUPPLY", h_style))
        if has_includes:
            left_col.append(Paragraph("<b>Includes:</b>", bold_style))
            left_col.append(Paragraph(str(scope_includes).replace('\n', '<br/>'), normal_style))
            left_col.append(Spacer(1, 0.4*cm))
        if has_excludes:
            left_col.append(Paragraph("<b>Excludes:</b>", bold_style))
            left_col.append(Paragraph(str(scope_excludes).replace('\n', '<br/>'), normal_style))
            left_col.append(Spacer(1, 0.8*cm))
    
    has_notes = notes and str(notes).strip() and not str(notes).startswith('[Other') and not str(notes).startswith('[Otra')
    if has_notes:
        left_col.append(Paragraph("TECHNICAL NOTES", h_style))
        notes_list = [
            "Prices subject to confirmation of stock and availability at the time of the purchase order.",
            "Quantities and specifications to be confirmed by the client before dispatch."
        ]
        for line in str(notes).split('\n'):
            line = line.strip()
            if line:
                # Remove leading dashes/bullets to avoid duplication
                if line.startswith('- ') or line.startswith('– ') or line.startswith('• '):
                    line = line[2:].strip()
                elif line.startswith('-') or line.startswith('–') or line.startswith('•'):
                    line = line[1:].strip()
                notes_list.append(line)
        
        for nl in notes_list:
            left_col.append(Paragraph(f"• {nl}", normal_style))
            left_col.append(Spacer(1, 0.2*cm))
            
    if not left_col:
        left_col.append(Paragraph("", normal_style))

    # Right Column: TERMS
    right_col = []
    right_col.append(Paragraph("TERMS &amp; CONDITIONS", h_style))
    terms_data = [
        [Paragraph("<b>Currency</b>", normal_style), Paragraph("USD", normal_style)]
    ]
    if offer_validity and str(offer_validity).strip():
        terms_data.append([Paragraph("<b>Offer validity</b>", normal_style), Paragraph(offer_validity, normal_style)])
    if payment_terms and str(payment_terms).strip():
        terms_data.append([Paragraph("<b>Payment terms</b>", normal_style), Paragraph(payment_terms, normal_style)])
    if delivery_time and str(delivery_time).strip():
        terms_data.append([Paragraph("<b>Delivery time</b>", normal_style), Paragraph(f"{delivery_time} days", normal_style)])
    if puerto or buque:
        terms_data.append([Paragraph("<b>Place of delivery</b>", normal_style), Paragraph(f"{puerto} / on board {buque}" if puerto and buque else f"{puerto or buque}", normal_style)])
        
    t_terms = Table(terms_data, colWidths=[2.8*cm, 4.8*cm])
    t_terms.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.25, HexColor('#e2e8f0')),
    ]))
    right_col.append(t_terms)
    
    # Put them in a 2-column table
    page2_table = Table([
        [left_col, "", right_col]
    ], colWidths=[8.5*cm, 1*cm, 8.5*cm])
    
    table_styles = [
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (2,0), (2,0), card_bg),
        ('BOX', (2,0), (2,0), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (2,0), (2,0), 6), ('BOTTOMPADDING', (2,0), (2,0), 6),
        ('LEFTPADDING', (2,0), (2,0), 12), ('RIGHTPADDING', (2,0), (2,0), 12),
    ]
    
    if has_includes or has_excludes or has_notes:
        table_styles.extend([
            ('BACKGROUND', (0,0), (0,0), card_bg),
            ('BOX', (0,0), (0,0), 0.5, HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (0,0), 6), ('BOTTOMPADDING', (0,0), (0,0), 6),
            ('LEFTPADDING', (0,0), (0,0), 12), ('RIGHTPADDING', (0,0), (0,0), 12),
        ])
        
    page2_table.setStyle(TableStyle(table_styles))
    story.append(page2_table)
    
    story.append(Spacer(1, 0.5*cm))
    
    # --- 7. SIGNATURE BLOCK ---
    user_name = f"{user.first_name} {user.last_name}".strip() if user and (user.first_name or user.last_name) else (user.username if user else "Proios Representative")
    user_role = user.rol if (user and hasattr(user, 'rol')) else "Operations"
    user_email = "operations@proios.com"
    
    sig_table = Table([
        [
            Paragraph("Yours faithfully,", normal_style),
            ""
        ],
        [
            Paragraph(f"<b>{user_name}</b><br/>{user_role} – Proios S.A.<br/><font color='#64748b'>{user_email}</font>", normal_style),
            ""
        ]
    ], colWidths=[8.5*cm, 9.5*cm])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (1,0), (1,0), 30),
        ('LINEABOVE', (0,1), (0,1), 1, HexColor('#cbd5e1')),
        ('TOPPADDING', (0,1), (0,1), 10),
    ]))
    
    # Use KeepTogether to avoid signature splitting
    story.append(KeepTogether(sig_table))
    
    # --- 8. SOLID CORPORATE FOOTER (CALLBACK) ---
    def add_proios_corporate_footer(canvas, doc):
        canvas.saveState()
        
        # --- Add Watermark ---
        logo_path = os.path.join(settings.BASE_DIR, 'static_local', 'logo.png')
        if os.path.exists(logo_path):
            canvas.saveState()
            canvas.setFillAlpha(0.08) # light transparency
            img_width = 12 * cm
            img_height = 12 * cm
            x = (A4[0] - img_width) / 2
            y = (A4[1] - img_height) / 2
            canvas.drawImage(logo_path, x, y, width=img_width, height=img_height, preserveAspectRatio=True, mask='auto')
            canvas.restoreState()

        # Draw a solid blue bar at the absolute bottom
        canvas.setFillColor(HexColor('#003366'))
        canvas.rect(0, 0, A4[0], 1.5*cm, fill=1, stroke=0)
        
        canvas.setFillColor(colors.white)
        canvas.setFont(DEFAULT_FONT, 7.5)
        footer_text = "Proios S.A. | Comodoro Pedro Zanni 351 floor 5th 503 LN. Buenos Aires (C1104AAH) Argentina | operations@proios.com | WWW.PROIOS.COM"
        canvas.drawCentredString(A4[0]/2.0, 0.6*cm, footer_text)
        
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_proios_corporate_footer, onLaterPages=add_proios_corporate_footer)
    return buffer.getvalue()


def generar_cotizacion_eva_pdf(operacion, offer_validity="15 days", payment_terms="30 days from invoice date", delivery_time="5", include_vat=True, scope_includes="[detail what the supply / service comprises]", scope_excludes="[freight, customs clearance, additional labour, parts not listed, etc.]", notes="[Other relevant note]", attn="Operations / Technical Department", lang="en", damage_location="", damage_frames="", damage_area="", custom_items="[]", damage_subject="DAMAGE DESCRIPTION", damage_location_title="Location and damage", damage_frames_title="Frame(s)", damage_area_title="Area L x H (mm)", vat_percentage="21", user=None):
    import os
    import io
    from datetime import datetime
    from django.conf import settings
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
    from reportlab.lib.colors import HexColor, Color
    card_bg = Color(248/255.0, 250/255.0, 252/255.0, alpha=0.4)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
    from reportlab.lib.units import cm
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    
    # Translations
    t = {
        'en': {
            'cat_quimicos': 'Chemicals', 'cat_productos': 'Products', 'cat_servicios': 'Services', 'cat_general': 'General',
            'quotation': 'QUOTATION', 'from': 'FROM', 'to': 'TO',
            'no': 'No.', 'date': 'Date', 'valid': 'Valid', 'vessel': 'Vessel', 'port': 'Port', 'location': 'Location', 'eta': 'ETA',
            'intro': 'We are pleased to submit our quotation for the works detailed below:',
            'intro_products': 'We are pleased to submit our quotation for the supply of products, as detailed below:',
            'items': 'ITEMS', 'desc': 'Description', 'cat': 'Category', 'qty': 'Qty', 'unit': 'Unit', 'price': 'Unit price', 'amount': 'Amount',
            'subtotal': 'Subtotal', 'vat': 'VAT', 'total': 'TOTAL', 'terms': 'TERMS',
            'currency': 'Currency', 'offer_val': 'Offer validity', 'payment': 'Payment terms', 'delivery': 'Delivery time',
            'place': 'Place of delivery', 'warranty': 'Warranty', 'taxes': 'Taxes',
            'damage_desc': 'DAMAGE DESCRIPTION', 'loc_damage': 'Location and damage', 'frames': 'Frame(s)', 'area': 'Area L x H (mm)',
            'scope': 'SCOPE OF SUPPLY', 'includes': 'Includes:', 'excludes': 'Excludes:', 'notes': 'TECHNICAL NOTES',
            'faithfully': 'Yours faithfully,', 'attn': 'Attn:', 'days': 'days', 'not_included': 'Not included',
            'vat_word': 'VAT', 'page': 'Page', 'operations': 'Operations', 'on_board': 'on board',
            'details': 'DETAILS', 'terms_title': 'TERMS &amp; CONDITIONS'
        },
        'es': {
            'cat_quimicos': 'Químicos', 'cat_productos': 'Productos', 'cat_servicios': 'Servicios', 'cat_general': 'General',
            'quotation': 'COTIZACIÓN', 'from': 'DE', 'to': 'PARA',
            'no': 'No.', 'date': 'Fecha', 'valid': 'Validez', 'vessel': 'Buque', 'port': 'Puerto', 'location': 'Ubicación', 'eta': 'ETA',
            'intro': 'Nos complace presentar nuestra cotización por los trabajos detallados a continuación:',
            'intro_products': 'Nos complace presentar nuestra cotización por el suministro de productos detallado a continuación:',
            'items': 'ARTÍCULOS', 'desc': 'Descripción', 'cat': 'Categoría', 'qty': 'Cant.', 'unit': 'Unidad', 'price': 'Precio unit.', 'amount': 'Importe',
            'subtotal': 'Subtotal', 'vat': 'IVA', 'total': 'TOTAL', 'terms': 'TÉRMINOS',
            'currency': 'Moneda', 'offer_val': 'Validez de oferta', 'payment': 'Forma de pago', 'delivery': 'Tiempo de entrega',
            'place': 'Lugar de entrega', 'warranty': 'Garantía', 'taxes': 'Impuestos',
            'damage_desc': 'DESCRIPCIÓN DE DAÑOS', 'loc_damage': 'Ubicación y daño', 'frames': 'Cuaderna(s)', 'area': 'Área L x H (mm)',
            'scope': 'ALCANCE DEL SUMINISTRO', 'includes': 'Incluye:', 'excludes': 'Excluye:', 'notes': 'NOTAS TÉCNICAS',
            'faithfully': 'Atentamente,', 'attn': 'Atención:', 'days': 'días', 'not_included': 'No incluidos',
            'vat_word': 'IVA', 'page': 'Página', 'operations': 'Operaciones', 'on_board': 'a bordo del',
            'details': 'DETALLES', 'terms_title': 'TÉRMINOS Y CONDICIONES'
        }
    }
    
    txt = t.get(lang, t['en'])
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=3*cm)
    story = []
    
    styles = getSampleStyleSheet()
    normal_style = styles['Normal']
    normal_style.fontSize = 9
    normal_style.leading = 13
    normal_style.textColor = HexColor('#1e293b')
    normal_style.fontName = DEFAULT_FONT
    
    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD)
    title_style = ParagraphStyle('TitleStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD, fontSize=28, leading=32, textColor=HexColor('#003366'), alignment=TA_LEFT, spaceAfter=0)
    card_title_style = ParagraphStyle('CardTitle', parent=bold_style, fontSize=8, textColor=HexColor('#64748b'), spaceAfter=6, textTransform='uppercase')
    
    # --- 1. HEADER (TITLE & LOGO) ---
    logo_path = os.path.join(settings.BASE_DIR, 'static_local', 'logo.png')
    logo_img = ""
    if os.path.exists(logo_path):
        logo_img = Image(logo_path, width=4.5*cm, height=4.5*cm, kind='proportional')
        
    header_top = Table([
        [Paragraph(txt['quotation'], title_style), logo_img]
    ], colWidths=[13*cm, 5*cm])
    header_top.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(header_top)
    story.append(Spacer(1, 0.5*cm))
    
    # --- 2. HEADER CARDS (FROM / TO / DETAILS) ---
    buque = operacion.ship.name if operacion.ship else "[Vessel Name]"
    puerto = operacion.port.name if operacion.port else "[Port]"
    eta_str = operacion.eta.strftime("%d/%m/%Y") if operacion.eta else "[ETA]"
    cliente_nombre = operacion.cliente.name if operacion.cliente else "[Client Name]"
    current_date = datetime.now().strftime('%d %b %Y')
    
    from_html = f"<b>Proios S.A.</b><br/>Comodoro Pedro Zanni<br/>351 floor 5th 503 LN.<br/>Buenos Aires (C1104AAH)<br/>Argentina<br/><br/><font color='#64748b'>Email:</font> operations@proios.com"
    to_html = f"<b>{cliente_nombre}</b><br/><br/><br/><font color='#64748b'>{txt['attn']}</font><br/>{attn}"
    
    loc_lbl = txt['location'] if operacion.tipo_operacion == 'servicios' else txt['port']
    details_html = f"<b>{txt['no']} PS-COT-{operacion.id:04d}</b><br/>{txt['date']}: {current_date}<br/>{txt['valid']}: {offer_validity}<br/><br/>{txt['vessel']}: <b>{buque}</b><br/>{loc_lbl}: {puerto}<br/>{txt['eta']}: {eta_str}"
    
    card_from = [Paragraph(txt['from'], card_title_style), Paragraph(from_html, normal_style)]
    card_to = [Paragraph(txt['to'], card_title_style), Paragraph(to_html, normal_style)]
    card_details = [Paragraph(txt['details'], card_title_style), Paragraph(details_html, normal_style)]
    
    cards_table = Table([
        [card_from, "", card_to, "", card_details]
    ], colWidths=[5.6*cm, 0.6*cm, 5.6*cm, 0.6*cm, 5.6*cm])
    
    cards_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (0,0), card_bg), ('BOX', (0,0), (0,0), 0.5, HexColor('#e2e8f0')), ('TOPPADDING', (0,0), (0,0), 6), ('BOTTOMPADDING', (0,0), (0,0), 6), ('LEFTPADDING', (0,0), (0,0), 12), ('RIGHTPADDING', (0,0), (0,0), 12),
        ('BACKGROUND', (2,0), (2,0), card_bg), ('BOX', (2,0), (2,0), 0.5, HexColor('#e2e8f0')), ('TOPPADDING', (2,0), (2,0), 6), ('BOTTOMPADDING', (2,0), (2,0), 6), ('LEFTPADDING', (2,0), (2,0), 12), ('RIGHTPADDING', (2,0), (2,0), 12),
        ('BACKGROUND', (4,0), (4,0), card_bg), ('BOX', (4,0), (4,0), 0.5, HexColor('#e2e8f0')), ('TOPPADDING', (4,0), (4,0), 6), ('BOTTOMPADDING', (4,0), (4,0), 6), ('LEFTPADDING', (4,0), (4,0), 12), ('RIGHTPADDING', (4,0), (4,0), 12),
    ]))
    story.append(cards_table)
    story.append(Spacer(1, 1*cm))
    
    from apps.inventario.models import Articulo
    import json
    
    grupos = {}
    detalles = list(operacion.detalles.all())
    for det in detalles:
        try:
            articulo = Articulo.objects.get(id=det.articulo_id)
            cat = str(articulo.categoria).strip() if articulo.categoria and str(articulo.categoria).strip() else "GENERAL"
            desc = articulo.nombre
            unit = str(articulo.unidad) if articulo.unidad else "u"
        except Articulo.DoesNotExist:
            cat = "GENERAL"
            desc = f"Item #{det.articulo_id}"
            unit = "u"
            
        cat = cat.upper()
        if cat not in grupos:
            grupos[cat] = []
        grupos[cat].append({
            'desc': desc,
            'qty': float(det.cantidad),
            'unit': unit,
            'price': float(det.precio_unitario) if det.precio_unitario else 0.0
        })

    try:
        if isinstance(custom_items, str):
            custom_items_list = json.loads(custom_items)
        else:
            custom_items_list = custom_items
            
        if isinstance(custom_items_list, list):
            if 'SERVICIOS' not in grupos:
                grupos['SERVICIOS'] = []
            for c_item in custom_items_list:
                qty = c_item.get('cantidad', 1)
                if not qty or str(qty).strip() == '': qty = 1
                price = c_item.get('precio_unitario', 0)
                if not price or str(price).strip() == '': price = 0
                
                qty = float(qty)
                price = float(price)
                grupos['SERVICIOS'].append({
                    'desc': c_item.get('nombre', ''),
                    'qty': qty,
                    'unit': 'UN',
                    'price': price,
                    'amount': qty * price
                })
    except Exception as e:
        import traceback
        traceback.print_exc()

    has_items = sum(len(items) for items in grupos.values()) > 0
    total_general = 0

    # --- 3. ITEMS INTRO ---
    if has_items:
        intro_text = txt['intro'] if operacion.tipo_operacion == 'servicios' else txt['intro_products']
        intro_style = ParagraphStyle('Intro', parent=normal_style, fontSize=10, textColor=HexColor('#334155'))
        story.append(Paragraph(intro_text, intro_style))
        story.append(Spacer(1, 0.5*cm))
        
        # --- 4. ITEMS TABLE ---
        th_style = ParagraphStyle('TH', parent=bold_style, textColor=colors.white, fontSize=9)
        th_right = ParagraphStyle('THR', parent=th_style, alignment=TA_RIGHT)
        th_center = ParagraphStyle('THC', parent=th_style, alignment=TA_CENTER)
        
        table_data = []
        table_data.append([
            Paragraph(txt['no'], th_center),
            Paragraph(txt['desc'], th_style),
            Paragraph(txt['qty'], th_center),
            Paragraph(txt['unit'], th_center),
            Paragraph(txt['price'] + " (USD)", th_right),
            Paragraph(txt['amount'] + " (USD)", th_right)
        ])
        
        idx = 1
        tr_style = ParagraphStyle('TR', parent=normal_style)
        tr_right = ParagraphStyle('TRR', parent=tr_style, alignment=TA_RIGHT)
        tr_center = ParagraphStyle('TRC', parent=tr_style, alignment=TA_CENTER)
        
        for cat_name, items in grupos.items():
            trans_cat_title = txt.get(f"cat_{cat_name.lower().strip()}", cat_name).upper()
            table_data.append([Paragraph(f"<b>{trans_cat_title}</b>", ParagraphStyle('Cat', parent=bold_style, textColor=HexColor('#003366'))), "", "", "", "", ""])
            subtotal_cat = 0
            for item in items:
                qty = item['qty']
                price = item['price']
                sub = qty * price
                subtotal_cat += sub
                total_general += sub
                
                table_data.append([
                    Paragraph(str(idx), tr_center),
                    Paragraph(item['desc'], tr_style),
                    Paragraph(str(int(qty) if qty.is_integer() else qty), tr_center),
                    Paragraph(item['unit'], tr_center),
                    Paragraph(f"{price:,.2f}", tr_right),
                    Paragraph(f"{sub:,.2f}", tr_right)
                ])
                idx += 1
                
            trans_cat_lower = txt.get(f"cat_{cat_name.lower().strip()}", cat_name).lower()
            table_data.append([
                Paragraph(f"{txt['subtotal']} {trans_cat_lower}", ParagraphStyle('SubCat', parent=normal_style, textColor=HexColor('#64748b'))),
                "", "", "", "",
                Paragraph(f"<b>{subtotal_cat:,.2f}</b>", ParagraphStyle('SubCatR', parent=bold_style, alignment=TA_RIGHT))
            ])
            
        col_widths = [1.2*cm, 7.8*cm, 1.5*cm, 1.5*cm, 2.8*cm, 3.2*cm]
        t = Table(table_data, colWidths=col_widths)
        
        ts = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), HexColor('#003366')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('TOPPADDING', (0,0), (-1,0), 8),
        ])
        
        row_idx = 1
        for cat_name, items in grupos.items():
            ts.add('BACKGROUND', (0, row_idx), (-1, row_idx), HexColor('#f1f5f9'))
            ts.add('SPAN', (0, row_idx), (-1, row_idx))
            ts.add('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 6)
            ts.add('TOPPADDING', (0, row_idx), (-1, row_idx), 6)
            row_idx += 1
            
            for _ in items:
                ts.add('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 8)
                ts.add('TOPPADDING', (0, row_idx), (-1, row_idx), 8)
                ts.add('LINEBELOW', (0, row_idx), (-1, row_idx), 0.5, HexColor('#e2e8f0'))
                row_idx += 1
                
            ts.add('SPAN', (0, row_idx), (4, row_idx))
            ts.add('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 8)
            ts.add('TOPPADDING', (0, row_idx), (-1, row_idx), 8)
            row_idx += 1
            
        t.setStyle(ts)
        story.append(t)
        story.append(Spacer(1, 0.8*cm))
        
        # --- 5. TOTALS PANEL ---
        tot_label_style = ParagraphStyle('TotL', parent=normal_style, alignment=TA_RIGHT, textColor=HexColor('#475569'))
        tot_val_style = ParagraphStyle('TotV', parent=normal_style, alignment=TA_RIGHT)
        tot_final_label = ParagraphStyle('TotFL', parent=bold_style, alignment=TA_RIGHT, fontSize=12, textColor=HexColor('#003366'))
        tot_final_val = ParagraphStyle('TotFV', parent=bold_style, alignment=TA_RIGHT, fontSize=14, textColor=HexColor('#003366'))
        
        if str(include_vat).lower() == 'true' or include_vat is True:
            tot_data = [
                [Paragraph(f"{txt['subtotal']}:", tot_label_style), Paragraph(f"USD {total_general:,.2f}", tot_val_style)],
                [Paragraph(f"{txt['vat']} (21%):", tot_label_style), Paragraph(f"USD {(float(total_general) * 0.21):,.2f}", tot_val_style)],
                [Paragraph(f"{txt['total']} USD:", tot_final_label), Paragraph(f"USD {(float(total_general) * 1.21):,.2f}", tot_final_val)]
            ]
        else:
            tot_data = [
                [Paragraph(f"{txt['total']} USD:", tot_final_label), Paragraph(f"USD {float(total_general):,.2f}", tot_final_val)]
            ]
            
        t_tot_inner = Table(tot_data, colWidths=[3.5*cm, 4*cm])
        t_tot_inner.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-2), 4),
            ('TOPPADDING', (0,0), (-1,-2), 4),
            ('BOTTOMPADDING', (0,-1), (-1,-1), 10),
            ('TOPPADDING', (0,-1), (-1,-1), 10),
            ('LINEABOVE', (0,-1), (-1,-1), 1, HexColor('#cbd5e1')),
        ]))
        
        t_tot_outer = Table([["", t_tot_inner]], colWidths=[10*cm, 8*cm])
        t_tot_outer.setStyle(TableStyle([
            ('BACKGROUND', (1,0), (1,0), card_bg),
            ('BOX', (1,0), (1,0), 1, HexColor('#003366')),
            ('LINEBEFORE', (1,0), (1,0), 4, HexColor('#003366')),
            ('LEFTPADDING', (1,0), (1,0), 10), ('RIGHTPADDING', (1,0), (1,0), 10), ('TOPPADDING', (1,0), (1,0), 10), ('BOTTOMPADDING', (1,0), (1,0), 10),
        ]))
        
        story.append(t_tot_outer)
        
    story.append(Spacer(1, 1*cm))
    
    # --- 6. PAGE 2: TWO COLUMN LAYOUT & DAMAGE ---
    has_damage_location = damage_location and str(damage_location).strip()
    has_damage_frames = damage_frames and str(damage_frames).strip()
    has_damage_area = damage_area and str(damage_area).strip()
    
    if operacion.tipo_operacion == 'servicios' and (has_damage_location or has_damage_frames or has_damage_area):
        story.append(Paragraph(damage_subject if damage_subject else txt['damage_desc'], ParagraphStyle('HStyle', parent=bold_style, fontSize=12, textColor=HexColor('#003366'), spaceAfter=12)))
        dmg_data = [
            [Paragraph(f"<b>{damage_location_title if damage_location_title else txt['loc_damage']}</b>", normal_style), Paragraph(f"<b>{damage_frames_title if damage_frames_title else txt['frames']}</b>", normal_style), Paragraph(f"<b>{damage_area_title if damage_area_title else txt['area']}</b>", normal_style)],
            [Paragraph(damage_location if has_damage_location else "-", normal_style), Paragraph(damage_frames if has_damage_frames else "-", normal_style), Paragraph(damage_area if has_damage_area else "-", normal_style)]
        ]
        t_dmg = Table(dmg_data, colWidths=[8.5*cm, 4.5*cm, 5*cm])
        t_dmg.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), HexColor('#f1f5f9')),
            ('BOX', (0,0), (-1,-1), 0.5, HexColor('#e2e8f0')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor('#e2e8f0')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(t_dmg)
        story.append(Spacer(1, 1*cm))
        
    h_style = ParagraphStyle('HStyle', parent=bold_style, fontSize=12, textColor=HexColor('#003366'), spaceAfter=12)
    
    left_col = []
    has_includes = scope_includes and str(scope_includes).strip() and not str(scope_includes).startswith('[detail') and not str(scope_includes).startswith('[detallar')
    has_excludes = scope_excludes and str(scope_excludes).strip() and not str(scope_excludes).startswith('[freight') and not str(scope_excludes).startswith('[fletes')
    
    if has_includes or has_excludes:
        left_col.append(Paragraph(txt['scope'], h_style))
        if has_includes:
            left_col.append(Paragraph(f"<b>{txt['includes']}</b>", bold_style))
            left_col.append(Paragraph(str(scope_includes).replace('\n', '<br/>'), normal_style))
            left_col.append(Spacer(1, 0.4*cm))
        if has_excludes:
            left_col.append(Paragraph(f"<b>{txt['excludes']}</b>", bold_style))
            left_col.append(Paragraph(str(scope_excludes).replace('\n', '<br/>'), normal_style))
            left_col.append(Spacer(1, 0.8*cm))
            
    has_notes = notes and str(notes).strip() and not str(notes).startswith('[Other') and not str(notes).startswith('[Otra')
    if has_notes:
        left_col.append(Paragraph(txt['notes'], h_style))
        notes_list = []
        for line in str(notes).split('\n'):
            line = line.strip()
            if line:
                if line.startswith('- ') or line.startswith('– ') or line.startswith('• '):
                    line = line[2:].strip()
                elif line.startswith('-') or line.startswith('–') or line.startswith('•'):
                    line = line[1:].strip()
                notes_list.append(line)
        for nl in notes_list:
            left_col.append(Paragraph(f"• {nl}", normal_style))
            left_col.append(Spacer(1, 0.2*cm))
            
    if not left_col:
        left_col.append(Paragraph("", normal_style))
        
    right_col = []
    right_col.append(Paragraph(txt['terms_title'], h_style))
    terms_data = [
        [Paragraph(f"<b>{txt['currency']}</b>", normal_style), Paragraph("USD", normal_style)]
    ]
    if offer_validity and str(offer_validity).strip():
        terms_data.append([Paragraph(f"<b>{txt['offer_val']}</b>", normal_style), Paragraph(offer_validity, normal_style)])
    if payment_terms and str(payment_terms).strip():
        terms_data.append([Paragraph(f"<b>{txt['payment']}</b>", normal_style), Paragraph(payment_terms, normal_style)])
    if delivery_time and str(delivery_time).strip():
        terms_data.append([Paragraph(f"<b>{txt['delivery']}</b>", normal_style), Paragraph(f"{delivery_time} {txt['days']}", normal_style)])
    if puerto or buque:
        terms_data.append([Paragraph(f"<b>{txt['place']}</b>", normal_style), Paragraph(f"{puerto} / {txt['on_board']} {buque}" if puerto and buque else f"{puerto or buque}", normal_style)])
    terms_data.append([Paragraph(f"<b>{txt['taxes']}</b>", normal_style), Paragraph(f"{txt['vat_word']} {vat_percentage}%" if (str(include_vat).lower() == 'true' or include_vat is True) else txt['not_included'], normal_style)])
    
    t_terms = Table(terms_data, colWidths=[2.8*cm, 4.8*cm])
    t_terms.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.25, HexColor('#e2e8f0')),
    ]))
    right_col.append(t_terms)
    
    page2_table = Table([[left_col, "", right_col]], colWidths=[8.5*cm, 1*cm, 8.5*cm])
    
    table_styles = [
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (2,0), (2,0), card_bg),
        ('BOX', (2,0), (2,0), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (2,0), (2,0), 6), ('BOTTOMPADDING', (2,0), (2,0), 6),
        ('LEFTPADDING', (2,0), (2,0), 12), ('RIGHTPADDING', (2,0), (2,0), 12),
    ]
    
    if has_includes or has_excludes or has_notes:
        table_styles.extend([
            ('BACKGROUND', (0,0), (0,0), card_bg),
            ('BOX', (0,0), (0,0), 0.5, HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (0,0), 6), ('BOTTOMPADDING', (0,0), (0,0), 6),
            ('LEFTPADDING', (0,0), (0,0), 12), ('RIGHTPADDING', (0,0), (0,0), 12),
        ])
        
    page2_table.setStyle(TableStyle(table_styles))
    story.append(page2_table)
    story.append(Spacer(1, 0.5*cm))
    
    # --- 7. SIGNATURE BLOCK ---
    user_name = f"{user.first_name} {user.last_name}".strip() if user and (user.first_name or user.last_name) else (user.username if user else "Proios Representative")
    user_role = user.rol if (user and hasattr(user, 'rol')) else txt.get('operations', 'Operations')
    user_email = "operations@proios.com"
    
    sig_table = Table([
        [Paragraph(txt['faithfully'], normal_style), ""],
        [Paragraph(f"<b>{user_name}</b><br/>{user_role} – Proios S.A.<br/><font color='#64748b'>{user_email}</font>", normal_style), ""]
    ], colWidths=[8.5*cm, 9.5*cm])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (1,0), (1,0), 30),
        ('LINEABOVE', (0,1), (0,1), 1, HexColor('#cbd5e1')),
        ('TOPPADDING', (0,1), (0,1), 10),
    ]))
    story.append(KeepTogether(sig_table))
    
    # --- 8. FOOTER WITH WATERMARK ---
    def add_proios_footer(canvas, doc):
        canvas.saveState()
        logo_path = os.path.join(settings.BASE_DIR, 'static_local', 'logo.png')
        if os.path.exists(logo_path):
            canvas.saveState()
            canvas.setFillAlpha(0.08)
            img_width = 12 * cm
            img_height = 12 * cm
            x = (A4[0] - img_width) / 2
            y = (A4[1] - img_height) / 2
            canvas.drawImage(logo_path, x, y, width=img_width, height=img_height, preserveAspectRatio=True, mask='auto')
            canvas.restoreState()

        canvas.setFillColor(HexColor('#003366'))
        canvas.rect(0, 0, A4[0], 1.5*cm, fill=1, stroke=0)
        
        canvas.setFillColor(colors.white)
        canvas.setFont(DEFAULT_FONT, 7.5)
        footer_text = "Proios S.A. | Comodoro Pedro Zanni 351 floor 5th 503 LN. Buenos Aires (C1104AAH) Argentina | operations@proios.com | WWW.PROIOS.COM"
        canvas.drawCentredString(A4[0]/2.0, 0.6*cm, footer_text)
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_proios_footer, onLaterPages=add_proios_footer)
    return buffer.getvalue()

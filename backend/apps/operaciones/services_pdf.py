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
    user_email = user.email if user and user.email else ""
    
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
    story.append(Spacer(1, 2*cm))
    
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

def generar_cotizacion_pdf_nativa(operacion, offer_validity="15 days", payment_terms="30 days from invoice date", delivery_time="5", include_vat=True, scope_includes="[detail what the supply / service comprises]", scope_excludes="[freight, customs clearance, additional labour, parts not listed, etc.]", notes="[Other relevant note]"):
    buffer = io.BytesIO()
    # Margins: Top, Bottom, Left, Right
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2.5*cm)
    story = []
    
    styles = getSampleStyleSheet()
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    normal_style.leading = 14
    normal_style.fontName = DEFAULT_FONT
    
    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD)
    title_style = ParagraphStyle('TitleStyle', parent=normal_style, fontName=DEFAULT_FONT_BOLD, fontSize=14, alignment=TA_CENTER, spaceAfter=20)
    right_style = ParagraphStyle('RightStyle', parent=normal_style, alignment=TA_RIGHT)
    total_style = ParagraphStyle('TotalStyle', parent=normal_style, alignment=TA_RIGHT, fontName=DEFAULT_FONT_BOLD, fontSize=12)
    footer_style = ParagraphStyle('FooterStyle', parent=normal_style, alignment=TA_CENTER, fontSize=8, textColor=colors.gray)
    
    # 1. Header Information
    buque = operacion.ship.name if operacion.ship else "[Vessel Name]"
    puerto = operacion.port.name if operacion.port else "[Port]"
    eta_str = operacion.eta.strftime("%d/%m/%Y") if operacion.eta else "[ETA]"
    agencia = operacion.agency.name if operacion.agency else "[Agency]"
    cliente_nombre = operacion.cliente.name if operacion.cliente else "[Client Name]"
    
    # Left Header
    story.append(Paragraph(f"<b>To:</b> {cliente_nombre}", normal_style))
    story.append(Paragraph(f"<b>Attn.:</b> Operations / Technical Department", normal_style))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f"<b>M/V:</b> {buque}", normal_style))
    story.append(Paragraph(f"<b>Port:</b> {puerto}", normal_style))
    story.append(Paragraph(f"<b>ETA:</b> {eta_str}", normal_style))
    story.append(Paragraph(f"<b>Agency:</b> {agencia}", normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Right Header
    story.append(Paragraph("<b>From:</b> Eva Proios", normal_style))
    story.append(Paragraph("Operations Department", normal_style))
    story.append(Paragraph(f"<b>Date:</b> {datetime.now().strftime('%B %d, %Y')}", normal_style))
    story.append(Spacer(1, 1*cm))
    
    # 2. Title
    story.append(Paragraph("QUOTATION", title_style))
    
    # 3. Intro
    tipo = operacion.tipo_operacion or ""
    tipo_mapped = "products"
    if tipo == 'quimicos': tipo_mapped = "chemicals"
    elif tipo == 'servicios': tipo_mapped = "services"
    elif tipo == 'otros': tipo_mapped = "spare parts"
    
    story.append(Paragraph(f"We are pleased to submit our quotation for the supply of <b>{tipo_mapped}</b>, as detailed below:", normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    # 4. Items Table
    table_data = [["No.", "Description", "Category", "Qty.", "Unit", "Unit price", "Total amount"]]
    total_usd = 0.0
    detalles = operacion.detalles.all()
    
    from apps.inventario.models import Articulo
    
    if detalles:
        for idx, det in enumerate(detalles, start=1):
            qty = det.cantidad
            price = float(det.precio_unitario)
            amount = qty * price
            total_usd += amount
            try:
                articulo = Articulo.objects.get(id=det.articulo_id)
                desc = articulo.nombre
                cat = str(articulo.categoria) if articulo.categoria else ""
                unit = str(articulo.unidad) if articulo.unidad else "u"
            except Articulo.DoesNotExist:
                desc = f"Articulo #{det.articulo_id}"
                cat = ""
                unit = "u"
            table_data.append([str(idx), desc, cat, str(qty), str(unit), f"{price:.2f}", f"{amount:.2f}"])
    else:
        table_data.append(["1", operacion.detalle_servicio or "[Description of product]", "[Chemicals]", "0", "u", "0.00", "0.00"])
        table_data.append(["", "", "", "", "", "", ""])
        table_data.append(["", "", "", "", "", "", ""])

    t = Table(table_data, colWidths=[1*cm, 6*cm, 3*cm, 1.5*cm, 1.5*cm, 2*cm, 2*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.black),
        ('FONTNAME', (0,0), (-1,0), DEFAULT_FONT_BOLD),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.black),
        ('BOX', (0,0), (-1,-1), 0.25, colors.black),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))
    
    # 5. Totals
    if str(include_vat).lower() == 'true' or include_vat is True:
        story.append(Paragraph(f"Subtotal:       {total_usd:.2f}", right_style))
        story.append(Paragraph(f"VAT (21%):      {(float(total_usd) * 0.21):.2f}", right_style))
        story.append(Paragraph(f"TOTAL USD:      {(float(total_usd) * 1.21):.2f}", total_style))
    else:
        story.append(Paragraph(f"TOTAL USD:      {float(total_usd):.2f}", total_style))
    
    story.append(PageBreak())
    
    # 6. TERMS
    story.append(Paragraph("<b>TERMS</b>", bold_style))
    terms_data = [
        ["Currency", "USD / ARS"],
        ["Offer validity", offer_validity],
        ["Payment terms", payment_terms],
        ["Delivery time", f"{delivery_time} days" if delivery_time else "[e.g. 5 business days from PO]"],
        ["Place of delivery", f"{puerto} / on board {buque}" if puerto and buque else "[port / warehouse / on board M/V ____]"]
    ]
    
    t_terms = Table(terms_data, colWidths=[4*cm, 13*cm])
    t_terms.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), DEFAULT_FONT_BOLD),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_terms)
    story.append(Spacer(1, 0.5*cm))
    
    # 7. SCOPE
    story.append(Paragraph("<b>SCOPE</b>", bold_style))
    story.append(Paragraph("<b>Includes:</b>", normal_style))
    story.append(Paragraph(str(scope_includes).replace('\n', '<br/>'), normal_style))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("<b>Excludes:</b>", normal_style))
    story.append(Paragraph(str(scope_excludes).replace('\n', '<br/>'), normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    # 8. NOTES
    story.append(Paragraph("<b>NOTES</b>", bold_style))
    notes_lines = [
        "Prices subject to confirmation of stock and availability at the time of the purchase order.",
        "Quantities and specifications to be confirmed by the client before dispatch."
    ]
    if notes and str(notes).strip() != "":
        for nl in str(notes).strip().split('\n'):
            if nl.strip():
                notes_lines.append(nl.strip())
                
    for nl in notes_lines:
        story.append(Paragraph(f"– {nl}", normal_style))
        
    story.append(Spacer(1, 1.5*cm))
    
    # 9. SIGNATURE
    story.append(Paragraph("Yours faithfully,", normal_style))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("<b>Eva Proios</b>", normal_style))
    story.append(Paragraph("Operations – Proios S.A.", normal_style))
    story.append(Paragraph("eva@proios.com · +549 11 57265031", normal_style))
    
    # Helper to add footer
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(DEFAULT_FONT, 8)
        canvas.setFillColor(colors.gray)
        canvas.drawCentredString(10.5*cm, 1*cm, "Proios S.A. · Buenos Aires, Argentina · eva@proios.com · +549 11 57265031")
        canvas.drawCentredString(10.5*cm, 0.5*cm, f"Page {doc.page}")
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

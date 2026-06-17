import io
import os
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

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
    logo_path = get_logo()
    if logo_path:
        img = RLImage(logo_path, width=4*cm, height=2*cm, kind='proportional')
        story.append(img)
    
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

def generar_cotizacion_servicio_pdf(operacion):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    story = []
    styles = getSampleStyleSheet()
    
    story = build_pdf_headers(doc, story, operacion, "Cotización de Servicio")
    
    # Detalle del servicio
    story.append(Paragraph("<b>Detalle del Servicio:</b>", styles['Heading3']))
    detalle = operacion.detalle_servicio or "No se especificaron detalles del servicio."
    story.append(Paragraph(detalle.replace('\n', '<br/>'), styles['Normal']))
    story.append(Spacer(1, 1*cm))
    
    forma_cotizacion = dict(operacion.COTIZACION_CHOICES).get(operacion.forma_cotizacion_servicio, operacion.forma_cotizacion_servicio)
    story.append(Paragraph(f"<b>Forma de Cotización:</b> {forma_cotizacion}", styles['Normal']))
    story.append(Spacer(1, 1*cm))
    
    if operacion.texto_cotizacion_adicional:
        story.append(Paragraph("<b>Condiciones / Notas Adicionales:</b>", styles['Heading3']))
        story.append(Paragraph(operacion.texto_cotizacion_adicional.replace('\n', '<br/>'), styles['Normal']))
        story.append(Spacer(1, 1*cm))
    
    # Precios
    data = [['Descripción', 'Monto']]
    total = 0
    for det in operacion.detalles.all():
        data.append([
            f"{det.cantidad} x Item #{det.articulo_id}", 
            f"USD {det.precio_unitario * det.cantidad:.2f}"
        ])
        total += (det.precio_unitario * det.cantidad)
    
    if len(data) > 1:
        data.append(['TOTAL', f"USD {total:.2f}"])
        t = Table(data, colWidths=[10*cm, 4*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#093641')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#e2e8f0')),
            ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 1, colors.black),
        ]))
        story.append(t)
        
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
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#093641')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
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

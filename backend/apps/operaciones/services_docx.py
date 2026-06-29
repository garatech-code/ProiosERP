import io
import os
from django.conf import settings
from datetime import datetime
from apps.inventario.models import Articulo
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION_START
from docx.oxml.shared import OxmlElement, qn

def insert_header_logo(document):
    """
    Busca la primera imagen disponible en la raíz del proyecto y la inserta
    en el encabezado (alineada a la derecha).
    """
    valid_logos = ['logo.png', 'header.png', 'brand.png', 'logo.jpg']
    logo_path = None
    
    for img in valid_logos:
        p = os.path.join(settings.BASE_DIR, 'static_local', img)
        if os.path.exists(p):
            logo_path = p
            break

    if logo_path:
        section = document.sections[0]
        header = section.header
        paragraph = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        
        run = paragraph.add_run()
        run.add_picture(logo_path, width=Cm(5.0))
        
        spacing_paragraph = header.add_paragraph()
        spacing_paragraph.paragraph_format.space_after = Pt(15)

def set_cell_border(cell, **kwargs):
    """
    Función de ayuda para establecer bordes finos en las celdas de las tablas.
    """
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = 'w:{}'.format(edge)
            element = OxmlElement(tag)
            for key in ["sz", "val", "color", "space", "shadow"]:
                if key in edge_data:
                    element.set(qn('w:{}'.format(key)), str(edge_data[key]))
            tcBorders.append(element)
    tcPr.append(tcBorders)

def generar_cotizacion_docx(operacion, offer_validity="15 days", payment_terms="30 days from invoice date", warranty="As per manufacturer"):
    doc = Document()
    
    # 1. Configurar márgenes de la página (Letter Size)
    section = doc.sections[0]
    section.page_width = Cm(21.59)
    section.page_height = Cm(27.94)
    section.top_margin = Cm(2.08)
    section.bottom_margin = Cm(2.08)
    section.left_margin = Cm(2.54)
    section.right_margin = Cm(2.54)

    # 2. HEADER
    insert_header_logo(doc)

    # 3. TÍTULO PRINCIPAL
    title = doc.add_paragraph()
    title_run = title.add_run("QUOTATION")
    title_run.bold = True
    title_run.font.size = Pt(26)
    title.paragraph_format.space_before = Pt(10)
    title.paragraph_format.space_after = Pt(20)

    # 4. BLOQUE SUPERIOR (3 COLUMNAS - Usamos una tabla sin bordes)
    top_table = doc.add_table(rows=1, cols=3)
    top_table.autofit = False
    
    # Variables a reemplazar
    cliente = operacion.cliente.name if operacion.cliente else ''
    buque = operacion.ship.name if operacion.ship else ''
    puerto = operacion.port.name if operacion.port else ''
    eta_str = operacion.eta.strftime('%d/%m/%Y %H:%M') if operacion.eta else ''
    ref_num = f"PS-COT-{operacion.fecha_creacion.year}-{operacion.id:03d}" if operacion.fecha_creacion else f"PS-COT-2026-{operacion.id:03d}"
    
    # Columna 1: FROM
    cell_1 = top_table.cell(0, 0)
    cell_1.width = Cm(6.0)
    p1 = cell_1.paragraphs[0]
    p1.add_run("FROM\n").bold = True
    p1.add_run("Proios S.A.\nBuenos Aires, Argentina\n[address]\n[tel.] · [email]")
    
    # Columna 2: TO
    cell_2 = top_table.cell(0, 1)
    cell_2.width = Cm(6.0)
    p2 = cell_2.paragraphs[0]
    p2.add_run("TO\n").bold = True
    p2.add_run(f"{cliente}\n\nAttn:\n[name and position]")

    # Columna 3: QUOTATION INFO
    cell_3 = top_table.cell(0, 2)
    cell_3.width = Cm(6.0)
    p3 = cell_3.paragraphs[0]
    p3.add_run("QUOTATION\n").bold = True
    current_date = datetime.now().strftime("%d %b %Y")
    p3.add_run(f"No. {ref_num}\nDate: {current_date}\nValid: {offer_validity}\n")
    p3.add_run(f"Vessel: {buque}\nPort: {puerto}\nETA: {eta_str}")

    doc.add_paragraph() # Espacio

    # 5. PÁRRAFO INTRODUCTORIO
    intro = doc.add_paragraph("We are pleased to submit our quotation for the supply of [products / spare parts / services], as detailed below:")
    intro.paragraph_format.space_after = Pt(15)

    # 6. SECCIÓN ITEMS
    items_title = doc.add_paragraph()
    run = items_title.add_run("ITEMS")
    run.bold = True
    run.font.size = Pt(8)

    headers = ["Description", "Category", "Qty", "Unit", "Unit price", "Amount"]
    items_table = doc.add_table(rows=1, cols=len(headers))
    items_table.style = 'Table Grid'
    
    # Llenar encabezados de la tabla
    hdr_cells = items_table.rows[0].cells
    for i, text in enumerate(headers):
        run = hdr_cells[i].paragraphs[0].add_run(text)
        run.bold = True
        
    # Obtener detalles de la operacion
    total_usd = 0
    detalles = operacion.detalles.all()
    if detalles:
        for det in detalles:
            row_cells = items_table.add_row().cells
            try:
                articulo = Articulo.objects.get(id=det.articulo_id)
                desc = articulo.nombre
                cat = articulo.categoria if articulo.categoria else ''
                unit = articulo.unidad if articulo.unidad else 'u'
            except Articulo.DoesNotExist:
                desc = f"Item #{det.articulo_id}"
                cat = ''
                unit = 'u'
            
            qty = det.cantidad
            price = det.precio_unitario
            amount = qty * price
            total_usd += amount
            
            row_cells[0].text = str(desc)
            row_cells[1].text = str(cat)
            row_cells[2].text = str(qty)
            row_cells[3].text = str(unit)
            row_cells[4].text = f"{price:.2f}"
            row_cells[5].text = f"{amount:.2f}"
    else:
        # Fila de ejemplo si no hay detalles
        row_cells = items_table.add_row().cells
        example_data = [operacion.detalle_servicio or "[Description of the product / spare part / service]", "[Chemicals]", "[0]", "[u/kg/lt]", "[0.00]", "[0.00]"]
        for i, text in enumerate(example_data):
            row_cells[i].text = text

        for _ in range(3):
            items_table.add_row()

    doc.add_paragraph() # Espaciado

    # Totales
    totals_p = doc.add_paragraph()
    totals_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    totals_p.add_run(f"Subtotal:       {total_usd:.2f}\n")
    totals_p.add_run(f"VAT (21%):      {(float(total_usd) * 0.21):.2f}\n")
    tot_run = totals_p.add_run(f"TOTAL USD:      {(float(total_usd) * 1.21):.2f}")
    tot_run.bold = True
    tot_run.font.size = Pt(12)

    doc.add_paragraph()

    # 7. TERMS
    doc.add_page_break()
    terms_title = doc.add_paragraph()
    run = terms_title.add_run("TERMS")
    run.bold = True
    run.font.size = Pt(8)

    terms_data = [
        ("Currency", "USD / ARS"),
        ("Offer validity", offer_validity),
        ("Payment terms", payment_terms),
        ("Delivery time", "[e.g. 5 business days from PO]"),
        ("Place of delivery", f"{puerto} / on board {buque}" if puerto and buque else "[port / warehouse / on board M/V ____]"),
        ("Warranty", warranty),
        ("Taxes", "VAT not included unless stated; other duties for the client’s account")
    ]
    
    terms_table = doc.add_table(rows=len(terms_data), cols=2)
    terms_table.autofit = False
    for i, (label, val) in enumerate(terms_data):
        terms_table.cell(i, 0).width = Cm(4.0)
        p_label = terms_table.cell(i, 0).paragraphs[0]
        p_label.add_run(label).bold = True
        
        terms_table.cell(i, 1).width = Cm(14.0)
        terms_table.cell(i, 1).text = val

    doc.add_paragraph()

    # 8. SCOPE
    scope_title = doc.add_paragraph()
    run = scope_title.add_run("SCOPE")
    run.bold = True
    run.font.size = Pt(8)
    
    doc.add_paragraph().add_run("Includes:\n").bold = True
    doc.paragraphs[-1].add_run("[detail what the supply / service comprises]")
    
    doc.add_paragraph().add_run("Excludes:\n").bold = True
    doc.paragraphs[-1].add_run("[freight, customs clearance, additional labour, parts not listed, etc.]")

    doc.add_paragraph()

    # 9. NOTES
    notes_title = doc.add_paragraph()
    run = notes_title.add_run("NOTES")
    run.bold = True
    run.font.size = Pt(8)
    
    notes = [
        "Prices subject to confirmation of stock and availability at the time of the purchase order.",
        "Quantities and specifications to be confirmed by the client before dispatch.",
        "[Other relevant note]"
    ]
    for note in notes:
        p = doc.add_paragraph(f"– {note}")
        p.paragraph_format.left_indent = Cm(0.5)

    # 10. FIRMA
    sig_p = doc.add_paragraph("Yours faithfully,\n\n")
    sig_name = sig_p.add_run("Eva Proios\n")
    sig_name.bold = True
    sig_p.add_run("Operations – Proios S.A.\n[email] · [phone]")
    sig_p.paragraph_format.space_after = Pt(20)

    # 11. FOOTER
    footer = section.footer
    footer_p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    f_run = footer_p.add_run("Proios S.A. · Buenos Aires, Argentina · [address] | [tel.] | [email] | [web]")
    f_run.font.size = Pt(8)
    footer_p.add_run("\nPage X").font.size = Pt(8)

    buffer = io.BytesIO()
    doc.save(buffer)
    docx_bytes = buffer.getvalue()
    buffer.close()
    
    return docx_bytes

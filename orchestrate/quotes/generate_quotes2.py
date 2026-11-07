import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def create_quote_pdf(filename, vendor_name, address, phone, item, qty, unit_price):
    doc = SimpleDocTemplate(filename, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#0f172a'))
    normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#334155'), leading=14)

    story.append(Paragraph(vendor_name, title_style))
    story.append(Paragraph(address, normal_style))
    story.append(Paragraph(f"Phone: {phone}", normal_style))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("<b>OFFICIAL QUOTATION</b>", styles['Heading2']))
    story.append(Paragraph("<b>Date:</b> October 24, 2026", normal_style))
    story.append(Paragraph(f"<b>Quote Ref:</b> QUT-{abs(hash(vendor_name + item)) % 100000}", normal_style))
    story.append(Spacer(1, 15))
    
    total = qty * unit_price
    table_data = [
        ["Item Description", "Qty", "Unit Price", "Total"],
        [item, str(qty), f"${unit_price:,.2f}", f"${total:,.2f}"]
    ]
    t = Table(table_data, colWidths=[260, 60, 90, 90])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("<b>Payment Terms:</b> Net 30 Days", normal_style))
    story.append(Paragraph("<b>Validity:</b> 30 days from quotation date", normal_style))
    
    doc.build(story)

output_dir = "data/sample_quotes"
os.makedirs(output_dir, exist_ok=True)

all_quotes = [
    # Scenario 1: Laptops (50)
    ("laptops_northline.pdf", "Northline Tech Partners", "100 Tech Way, Austin, TX", "(512) 555-0142", "Latitude 5440 Laptop (i7, 16GB)", 50, 3900.0),
    ("laptops_bridgepoint.pdf", "Bridgepoint Office Supplies Inc", "450 Industrial Pkwy, Columbus, OH", "(614) 555-0198", "Latitude 5440 Laptop (i7, 16GB)", 50, 1180.0),
    ("laptops_apex.pdf", "Apex Digital Solutions LLC", "450 Industrial Pkwy, Columbus, OH", "(614) 555-0198", "Latitude 5440 Laptop (i7, 16GB)", 50, 1195.0),
    ("laptops_cornerstone.pdf", "Cornerstone Tech Group", "789 Market St, San Francisco, CA", "(415) 555-0111", "Latitude 5440 Laptop (i7, 16GB)", 50, 1210.0),
    
    # Scenario 2: Chairs (120) - Clean case
    ("chairs_apex.pdf", "Apex Digital Solutions LLC", "450 Industrial Pkwy, Columbus, OH", "(614) 555-0198", "Ergonomic Mesh Office Chair", 120, 198.0),
    ("chairs_bridgepoint.pdf", "Bridgepoint Office Supplies Inc", "12 Government Center, Columbus, OH", "(614) 555-0177", "Ergonomic Mesh Office Chair", 120, 205.0),
    ("chairs_cornerstone.pdf", "Cornerstone Tech Group", "789 Market St, San Francisco, CA", "(415) 555-0111", "Ergonomic Mesh Office Chair", 120, 215.0),

    # Scenario 3: Toner (400) - Single price flag case
    ("toner_northline.pdf", "Northline Tech Partners", "100 Tech Way, Austin, TX", "(512) 555-0142", "High-Yield Laser Toner Cartridge", 400, 58.0),
    ("toner_bridgepoint.pdf", "Bridgepoint Office Supplies Inc", "450 Industrial Pkwy, Columbus, OH", "(614) 555-0198", "High-Yield Laser Toner Cartridge", 400, 40.0),
    ("toner_cornerstone.pdf", "Cornerstone Tech Group", "789 Market St, San Francisco, CA", "(415) 555-0111", "High-Yield Laser Toner Cartridge", 400, 41.0),
]

for filename, vendor, addr, phone, item, qty, price in all_quotes:
    create_quote_pdf(os.path.join(output_dir, filename), vendor, addr, phone, item, qty, price)

print(f"Successfully generated all category sample quotes in '{output_dir}/'")
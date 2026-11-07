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
    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName='Helvetica-Bold')

    # Header
    story.append(Paragraph(vendor_name, title_style))
    story.append(Paragraph(address, normal_style))
    story.append(Paragraph(f"Phone: {phone}", normal_style))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("<b>OFFICIAL QUOTATION</b>", styles['Heading2']))
    story.append(Paragraph(f"<b>Date:</b> October 24, 2026", normal_style))
    story.append(Paragraph(f"<b>Quote Ref:</b> QUT-{abs(hash(vendor_name)) % 100000}", normal_style))
    story.append(Spacer(1, 15))
    
    # Table of items
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
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
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

# Output directory
output_dir = "data/sample_quotes"
os.makedirs(output_dir, exist_ok=True)

# Generate the 4 quotes for the laptops-50 scenario
quotes_data = [
    ("quote_northline.pdf", "Northline Tech Partners", "100 Tech Way, Suite 400, Austin, TX", "(512) 555-0142", "Latitude 5440 Business Laptop (i7, 16GB, 512GB SSD)", 50, 3900.0),
    ("quote_bridgepoint.pdf", "Bridgepoint Office Supplies Inc", "450 Industrial Parkway, Building B, Columbus, OH", "(614) 555-0198", "Latitude 5440 Business Laptop (i7, 16GB, 512GB SSD)", 50, 1180.0),
    ("quote_apex.pdf", "Apex Digital Solutions LLC", "450 Industrial Parkway, Building B, Columbus, OH", "(614) 555-0198", "Latitude 5440 Business Laptop (i7, 16GB, 512GB SSD)", 50, 1195.0),
    ("quote_cornerstone.pdf", "Cornerstone Tech Group", "789 Market Street, San Francisco, CA", "(415) 555-0111", "Latitude 5440 Business Laptop (i7, 16GB, 512GB SSD)", 50, 1210.0),
]

for filename, vendor, addr, phone, item, qty, price in quotes_data:
    create_quote_pdf(os.path.join(output_dir, filename), vendor, addr, phone, item, qty, price)

print(f"Successfully generated 4 mock quote PDFs in '{output_dir}/'")
from pathlib import Path

objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] "
    b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
]

content = b"BT /F1 18 Tf 30 50 Td (Upload validation test) Tj ET"
objects.append(
    b"<< /Length " + str(len(content)).encode() + b" >>\n"
    b"stream\n" + content + b"\nendstream"
)
objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
offsets = [0]

for number, obj in enumerate(objects, start=1):
    offsets.append(len(pdf))
    pdf.extend(f"{number} 0 obj\n".encode())
    pdf.extend(obj)
    pdf.extend(b"\nendobj\n")

xref_offset = len(pdf)
pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
pdf.extend(b"0000000000 65535 f \n")

for offset in offsets[1:]:
    pdf.extend(f"{offset:010d} 00000 n \n".encode())

pdf.extend(
    f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
    f"startxref\n{xref_offset}\n%%EOF\n".encode()
)

Path("valid-test.pdf").write_bytes(pdf)
print(f"Created valid-test.pdf ({len(pdf)} bytes)")
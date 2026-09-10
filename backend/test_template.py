from docxtpl import DocxTemplate
import docx
doc = docx.Document()
doc.add_paragraph("{% p if expensas %} HIDDEN {% p endif %}")
doc.save("/tmp/test_p_space.docx")

try:
    tpl = DocxTemplate("/tmp/test_p_space.docx")
    tpl.render({"expensas": []})
    print("SUCCESS P WITH SPACE")
except Exception as e:
    print(f"ERROR WITH SPACE: {e}")

import sys
from pdf2docx import Converter

pdf_file = sys.argv[1]
docx_file = sys.argv[2]

converter = Converter(pdf_file)

try:
    converter.convert(docx_file)
finally:
    converter.close()
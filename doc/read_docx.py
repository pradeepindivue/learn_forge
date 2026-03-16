import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def extract_text_from_docx(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            texts = []
            for node in tree.iterfind('.//w:p', namespaces):
                para_texts = [t.text for t in node.iterfind('.//w:t', namespaces) if t.text]
                if para_texts:
                    texts.append(''.join(para_texts))
            
            return '\n'.join(texts)
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    with open('output.txt', 'w', encoding='utf-8') as f:
        for path in sys.argv[1:]:
            f.write(f"--- {os.path.basename(path)} ---\n")
            f.write(extract_text_from_docx(path) + "\n")
            f.write("="*80 + "\n")

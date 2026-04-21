import os
import sys
import json
import re
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict

def parse_articles(markdown_text):
    # Regex to find articles like "MADDE 1", "Madde 2:", "MADDE 3-", etc.
    # It looks for the word MADDE followed by a number and some separator
    pattern = r'(?m)^(MADDE \d+|Madde \d+)[:\-\s\.]+'
    
    sections = re.split(pattern, markdown_text)
    
    if len(sections) < 2:
        return []
    
    # The first element is usually preamble (Regulation name, scope, etc.)
    articles = []
    
    # Title is usually at the beginning of the markdown
    title_match = re.search(r'^#\s+(.*)', markdown_text)
    title = title_match.group(1).strip() if title_match else "Bilinmeyen Yönetmelik"

    for i in range(1, len(sections), 2):
        article_number = sections[i].strip()
        article_content = sections[i+1].strip() if i+1 < len(sections) else ""
        
        # Clean up the content (remove excessive spaces, etc.)
        article_content = re.sub(r'\s+', ' ', article_content).strip()
        
        articles.append({
            "article_number": article_number,
            "content": article_content
        })
        
    return {
        "title": title,
        "articles": articles
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "PDF yolu belirtilmedi."}))
        return

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"Dosya bulunamadı: {pdf_path}"}))
        return

    try:
        # Initialize marker converter
        converter = PdfConverter(
            artifact_dict=create_model_dict(),
        )
        
        # Convert PDF to markdown
        rendered = converter.convert(pdf_path)
        markdown_text = rendered.markdown
        
        # Parse articles from markdown
        result = parse_articles(markdown_text)
        
        if not result["articles"]:
             # Fallback: maybe the title is the first line or filename
             result["title"] = os.path.basename(pdf_path).replace(".pdf", "")
        
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()

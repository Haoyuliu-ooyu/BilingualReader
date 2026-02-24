import fitz  # PyMuPDF
import json

def parse_pdf(pdf_path):
    """
    Extracts text blocks and coordinates from a PDF.
    Returns a list of pages with structured content.
    """
    doc = fitz.open(pdf_path)
    pages = []

    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict")["blocks"]
        parsed_blocks = []

        for block in blocks:
            if block["type"] == 0:  # Text block
                for line in block["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if not text:
                            continue
                        
                        parsed_blocks.append({
                            "text": text,
                            "bbox": span["bbox"],  # [x0, y0, x1, y1]
                            "font": span["font"],
                            "size": span["size"],
                            "color": span["color"]
                        })
        
        pages.append({
            "page_number": page_num + 1,
            "blocks": parsed_blocks,
            "width": page.rect.width,
            "height": page.rect.height
        })

    return pages

if __name__ == "__main__":
    # Test
    # print(json.dumps(parse_pdf("test.pdf"), indent=2))
    pass

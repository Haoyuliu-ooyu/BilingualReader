import fitz  # PyMuPDF
import re
from sqlalchemy.orm import Session
from .models import Document, Page, SourceSegment

class PDFExtractor:
    def __init__(self, db_session: Session):
        self.db = db_session

    def clean_text(self, text: str) -> str:
        """Removes hyphenation artifacts and cleans up whitespace."""
        # Replace hyphen followed by newline with nothing (joins broken words)
        text = re.sub(r'-\n\s*', '', text)
        # Replace remaining single newlines with a space
        text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
        return text.strip()

    def extract_and_save(self, pdf_path: str, job_id: str) -> str:
        """
        Extracts spatial text from PDF, links it to Gateway job_id, 
        and returns the path to a continuous text file for the World Bible agent.
        """
        doc = fitz.open(pdf_path)
        
        full_text_content = []
        
        # 2. Iterate pages
        for page_num in range(len(doc)):
            page = doc[page_num]
            rect = page.rect
            
            # Save Page Record
            db_page = Page(
                doc_id=job_id,
                page_number=page_num + 1,
                width=rect.width,
                height=rect.height
            )
            self.db.add(db_page)
            self.db.flush() # Get page_id
            
            # 3. Extract Text Blocks (using 'dict' to get bboxes easily)
            # blocks format: [x0, y0, x1, y1, "lines in block", block_no, block_type]
            # text type blocks have block_type == 0
            blocks = page.get_text("blocks")
            
            block_idx = 0
            for b in blocks:
                if b[6] == 0:  # block_type 0 means text
                    raw_text = b[4]
                    cleaned_text = self.clean_text(raw_text)
                    
                    if not cleaned_text:
                        continue
                        
                    bbox = [b[0], b[1], b[2], b[3]]
                    
                    # 4. Save Segment
                    db_segment = SourceSegment(
                        page_id=db_page.page_id,
                        block_index=block_idx,
                        original_text=cleaned_text,
                        bbox=bbox
                    )
                    self.db.add(db_segment)
                    
                    full_text_content.append(cleaned_text)
                    block_idx += 1
                    
        self.db.commit()
        
        # 5. Output continuous string to temp file
        txt_path = f"/tmp/{job_id}_full_text.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(full_text_content))
            
        doc.close()
        return txt_path

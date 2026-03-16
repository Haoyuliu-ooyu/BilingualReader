import fitz  # PyMuPDF
import re

import structlog
from sqlalchemy.orm import Session
from .models import Document, Page, SourceSegment

log = structlog.get_logger("worker.extractor")


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

    def _check_quality(self, segments_text: list[str], job_id: str) -> None:
        """Warn about potential extraction quality issues."""
        if not segments_text:
            return
        total_chars = sum(len(t) for t in segments_text)
        if total_chars == 0:
            return

        # Check for high ratio of non-printable characters
        non_printable = sum(1 for t in segments_text for c in t if not c.isprintable() and c not in '\n\r\t')
        non_printable_ratio = non_printable / total_chars if total_chars > 0 else 0

        # Check for very short average segment length
        avg_length = total_chars / len(segments_text)

        warnings = []
        if non_printable_ratio > 0.1:
            warnings.append(f"High non-printable character ratio: {non_printable_ratio:.1%}")
        if avg_length < 5 and len(segments_text) > 3:
            warnings.append(f"Very short average segment length: {avg_length:.1f} chars")

        if warnings:
            log.warning("extractor.quality_issues", job_id=job_id, issues=warnings)

    def extract_and_save(self, pdf_path: str, job_id: str) -> str:
        """
        Extracts spatial text from PDF, links it to Gateway job_id,
        and returns the path to a continuous text file for the context agent.
        Falls back to OCR when PyMuPDF returns 0 text blocks on the first page.
        """
        doc = fitz.open(pdf_path)

        full_text_content = []

        # Check first page for text content to detect scanned PDFs
        use_ocr = False
        if len(doc) > 0:
            first_page = doc[0]
            blocks = first_page.get_text("blocks")
            text_blocks = [b for b in blocks if b[6] == 0 and b[4].strip()]
            if not text_blocks:
                log.info("extractor.no_text_detected", job_id=job_id, attempting="ocr")
                try:
                    ocr_text = first_page.get_text("text", ocr=True)
                    if ocr_text and ocr_text.strip():
                        use_ocr = True
                        log.info("extractor.ocr_enabled", job_id=job_id)
                    else:
                        log.error("extractor.ocr_failed", job_id=job_id,
                                  reason="OCR returned no text")
                        raise Exception(
                            "Could not extract text - PDF may be image-only or corrupted. "
                            "OCR was attempted but returned no readable text."
                        )
                except Exception as e:
                    if "Could not extract text" in str(e):
                        raise
                    log.error("extractor.ocr_unavailable", job_id=job_id, error=str(e))
                    raise Exception(
                        "Could not extract text - PDF may be image-only or corrupted. "
                        "OCR is not available (Tesseract may not be installed)."
                    )

        # Iterate pages
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
            self.db.flush()  # Get page_id

            if use_ocr:
                # OCR mode: get full text per page
                page_text = page.get_text("text", ocr=True)
                # Split into paragraphs as pseudo-blocks
                paragraphs = [p.strip() for p in page_text.split("\n\n") if p.strip()]
                for block_idx, para in enumerate(paragraphs):
                    cleaned = self.clean_text(para)
                    if not cleaned:
                        continue
                    # Use full page as bbox for OCR blocks
                    bbox = [0, 0, rect.width, rect.height]
                    db_segment = SourceSegment(
                        page_id=db_page.page_id,
                        block_index=block_idx,
                        original_text=cleaned,
                        bbox=bbox
                    )
                    self.db.add(db_segment)
                    full_text_content.append(cleaned)
            else:
                # Normal text extraction
                blocks = page.get_text("blocks")

                block_idx = 0
                for b in blocks:
                    if b[6] == 0:  # block_type 0 means text
                        raw_text = b[4]
                        cleaned_text = self.clean_text(raw_text)

                        if not cleaned_text:
                            continue

                        bbox = [b[0], b[1], b[2], b[3]]

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

        # Quality check before writing output
        self._check_quality(full_text_content, job_id)

        # Output continuous string to temp file
        txt_path = f"/tmp/{job_id}_full_text.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(full_text_content))

        doc.close()
        log.info("extractor.complete", job_id=job_id, pages=len(doc) if not doc.is_closed else page_num + 1,
                 segments=len(full_text_content), ocr=use_ocr)
        return txt_path

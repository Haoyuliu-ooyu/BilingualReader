import sys
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
from .extractor import PDFExtractor
from .context_agent import ContextAgent
from .translator import TranslationAgent

# Assume Config is set locally or via env
import os
DB_URL_RAW = os.getenv("DB_URL", "postgresql://postgres:prism@localhost:5432/prism")
DB_URL = DB_URL_RAW.replace("postgres://", "postgresql://", 1)

def init_db():
    engine = create_engine(DB_URL)
    # Ensure tables exist for the new V2 schema
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()

def run_pipeline(job_id: str, pdf_path: str, filename: str, target_lang: str):
    db_session = init_db()
    
    try:
        print(f"=== Starting Pipeline for {filename} (Job: {job_id}) ===")
        
        # 1. Module A: Extraction
        print("\n--- PHASE 1: Spatial Extraction ---")
        extractor = PDFExtractor(db_session)
        txt_path = extractor.extract_and_save(pdf_path, job_id)
        print(f"Extraction complete. Doc ID: {job_id}")
        
        # 2. Module B: World Bible Generation (Gemini)
        print("\n--- PHASE 2: Context Agent (Gemini) ---")
        context_agent = ContextAgent(db_session)
        # In a real scenario with checkpoints, we'd check if metadata already exists
        world_bible = context_agent.generate_world_bible(txt_path, job_id)
        
        # 3. Module C: Translation (Claude)
        print("\n--- PHASE 3: Translation Agent (Claude) ---")
        translator = TranslationAgent(db_session)
        translator.process_document(job_id, target_lang)
        
        print(f"\n=== Pipeline Completed Successfully for {filename} ===")
        
    except Exception as e:
        print(f"\n=== Pipeline Failed: {e} ===")
        # In a real worker, we would update the job status to FAILED in the DB here
        db_session.rollback()
        raise
    finally:
        db_session.close()

if __name__ == "__main__":
    # Example usage for local testing
    if len(sys.argv) < 3:
        print("Usage: python pipeline.py <path_to_pdf> <target_language>")
        sys.exit(1)
        
    pdf_file = sys.argv[1]
    lang = sys.argv[2]
    filename = os.path.basename(pdf_file)
    
    import uuid
    mock_job_id = str(uuid.uuid4())
    run_pipeline(mock_job_id, pdf_file, filename, lang)

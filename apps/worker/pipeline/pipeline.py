import os
import sys

import structlog
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .context_agent import ContextAgent
from .extractor import PDFExtractor
from .translator import TranslationAgent

log = structlog.get_logger("worker.pipeline")

# Assume Config is set locally or via env
DB_URL_RAW = os.getenv("DB_URL", "postgresql://postgres:prism@localhost:5432/prism")
DB_URL = DB_URL_RAW.replace("postgres://", "postgresql://", 1)


def init_db():
    engine = create_engine(DB_URL, pool_pre_ping=True, pool_recycle=3600)
    Session = sessionmaker(bind=engine)
    return Session()


def run_pipeline(job_id: str, pdf_path: str, filename: str, target_lang: str,
                  llm_provider: str = "", llm_model: str = "", llm_api_key: str = "",
                  shutdown_event=None, db_service=None):
    """
    llm_provider / llm_model / llm_api_key come from the job payload.
    llm_api_key is already decrypted plaintext at this point.
    shutdown_event is a threading.Event checked between pipeline phases.
    """
    from .llm_client import LLMClient, LLMConfig

    db_session = init_db()

    # Build a unified LLM client when credentials are available
    llm_client = None
    if llm_provider and llm_api_key:
        llm_client = LLMClient(LLMConfig(
            provider=llm_provider,
            model=llm_model,
            api_key=llm_api_key,
        ))

    try:
        log.info("pipeline.starting", job_id=job_id, filename=filename, provider=llm_provider or "mock")

        # 1. Module A: Extraction
        if db_service:
            db_service.update_progress(job_id, "extracting")
        log.info("pipeline.phase_starting", job_id=job_id, phase="extraction")
        extractor = PDFExtractor(db_session)
        txt_path = extractor.extract_and_save(pdf_path, job_id)
        log.info("pipeline.phase_complete", job_id=job_id, phase="extraction")

        # Count total segments for progress reporting
        from .models import SourceSegment, Page
        total_segments = db_session.query(SourceSegment).join(SourceSegment.page).filter(
            Page.doc_id == job_id
        ).count()

        # Check shutdown between phases
        if shutdown_event and shutdown_event.is_set():
            log.info("pipeline.shutdown_between_phases", job_id=job_id, phase="extraction")
            raise InterruptedError("Shutdown requested after extraction")

        # 2. Module B: Translation Context Generation
        if db_service:
            db_service.update_progress(job_id, "generating_context", total_count=total_segments)
        log.info("pipeline.phase_starting", job_id=job_id, phase="translation_context", provider=llm_provider or "mock")
        context_agent = ContextAgent(db_session, llm_client=llm_client)
        translation_context = context_agent.generate_translation_context(txt_path, job_id)
        log.info("pipeline.phase_complete", job_id=job_id, phase="translation_context")

        # Check shutdown between phases
        if shutdown_event and shutdown_event.is_set():
            log.info("pipeline.shutdown_between_phases", job_id=job_id, phase="context")
            raise InterruptedError("Shutdown requested after context generation")

        # 3. Module C: Translation
        def on_progress(translated_count, total_count):
            if db_service:
                db_service.update_progress(job_id, "translating",
                                           translated_count=translated_count,
                                           total_count=total_count)

        if db_service:
            db_service.update_progress(job_id, "translating", total_count=total_segments)
        log.info("pipeline.phase_starting", job_id=job_id, phase="translation", provider=llm_provider or "mock")
        translator = TranslationAgent(db_session, llm_client=llm_client,
                                      shutdown_event=shutdown_event,
                                      progress_callback=on_progress)
        translator.process_document(job_id, target_lang)
        log.info("pipeline.phase_complete", job_id=job_id, phase="translation")

        log.info("pipeline.completed", job_id=job_id, filename=filename)

    except InterruptedError:
        log.info("pipeline.interrupted", job_id=job_id)
        raise
    except Exception as e:
        log.error("pipeline.failed", job_id=job_id, error=str(e))
        db_session.rollback()
        raise
    finally:
        db_session.close()


if __name__ == "__main__":
    # Example usage for local testing
    if len(sys.argv) < 3:
        log.error("pipeline.usage", message="Usage: python pipeline.py <path_to_pdf> <target_language>")
        sys.exit(1)

    pdf_file = sys.argv[1]
    lang = sys.argv[2]
    filename = os.path.basename(pdf_file)

    import uuid
    mock_job_id = str(uuid.uuid4())
    run_pipeline(mock_job_id, pdf_file, filename, lang)

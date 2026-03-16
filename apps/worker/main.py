import json
import os
import signal
import sys
import threading
import time

import structlog

from config import Config
from logging_config import configure_logging
from services.db import DBService
from services.queue import QueueService

# Helper to download file from S3 (using boto3 directly or service)
import boto3

log = structlog.get_logger("worker.main")

shutdown_requested = threading.Event()


def handle_signal(signum, frame):
    log.info("worker.signal_received", signal=signum)
    shutdown_requested.set()


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def download_file(s3_key, local_path):
    s3 = boto3.client('s3',
        endpoint_url=Config.S3_ENDPOINT,
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        region_name=Config.S3_REGION
    )
    try:
        s3.download_file(Config.S3_BUCKET, s3_key, local_path)
        return True
    except Exception as e:
        log.error("s3.download_failed", s3_key=s3_key, error=str(e))
        return False


def main():
    configure_logging()

    log.info("worker.starting")

    # Initialize Services
    try:
        db = DBService(Config.DB_URL)
        queue = QueueService(Config.REDIS_ADDR)
    except Exception as e:
        log.error("worker.init_failed", error=str(e))
        time.sleep(5)
        sys.exit(1)

    log.info("worker.ready", queue="tasks:process_pdf")

    while not shutdown_requested.is_set():
        try:
            task = queue.get_task("tasks:process_pdf", timeout=5)

            if task:
                log.info("job.received", job_id=task.get("job_id"))
                process_task(db, queue, task, shutdown_requested)
            else:
                pass

        except Exception as e:
            log.error("worker.loop_error", error=str(e))
            time.sleep(1)

    log.info("worker.shutdown", reason="signal_received")


from pipeline.pipeline import run_pipeline
from pipeline.crypto import decrypt_api_key
from errors import LLMAuthError, LLMRateLimitError


def process_task(db, queue, task, shutdown_event):
    job_id = task.get('job_id')
    s3_key = task.get('s3_key')
    target_lang = task.get('target_lang', 'ES')
    original_name = task.get('original_name', f"{job_id}.pdf")
    llm_provider = task.get('llm_provider', '')
    llm_model = task.get('llm_model', '')
    encrypted_key = task.get('llm_api_key', '')

    # Decrypt the API key that was encrypted by the gateway
    llm_api_key = ''
    if encrypted_key:
        try:
            llm_api_key = decrypt_api_key(encrypted_key)
        except Exception as e:
            log.error("job.decrypt_failed", job_id=job_id, error=str(e))

    try:
        # Update Status to PROCESSING
        db.update_job_status(job_id, "PROCESSING")

        # 1. Download PDF
        local_pdf_path = f"/tmp/{job_id}.pdf"
        log.info("job.downloading", job_id=job_id, s3_key=s3_key, local_path=local_pdf_path)
        if not download_file(s3_key, local_pdf_path):
            raise Exception("Download failed")

        # 2. Run Pipeline
        log.info("job.pipeline_starting", job_id=job_id)
        run_pipeline(
            job_id, local_pdf_path, original_name, target_lang,
            llm_provider=llm_provider,
            llm_model=llm_model,
            llm_api_key=llm_api_key,
            shutdown_event=shutdown_event,
            db_service=db,
        )

        # Cleanup
        if os.path.exists(local_pdf_path):
            os.remove(local_pdf_path)

        db.update_job_status(job_id, "COMPLETED")

        log.info("job.completed", job_id=job_id)

    except InterruptedError:
        log.info("job.interrupted", job_id=job_id)
        db.update_job_status(job_id, "INTERRUPTED")
        queue.push_task("tasks:process_pdf", task)

    except LLMAuthError as e:
        db.update_error(job_id, "LLM_AUTH_FAILED", f"Invalid API key for {e.provider}")
        log.error("job.auth_failed", job_id=job_id, provider=e.provider)

    except LLMRateLimitError as e:
        db.update_error(job_id, "LLM_RATE_LIMITED", f"Rate limit exceeded for {e.provider} after retries")
        log.error("job.rate_limited", job_id=job_id, provider=e.provider)

    except Exception as e:
        db.update_error(job_id, "PIPELINE_ERROR", str(e)[:500])
        log.error("job.failed", job_id=job_id, error=str(e))


if __name__ == "__main__":
    main()

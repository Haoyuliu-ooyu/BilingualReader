import json

import psycopg2
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

log = structlog.get_logger("worker.db")


class DBService:
    def __init__(self, db_url):
        self.db_url = db_url
        self.conn = None
        self._connect_with_retry()

    @retry(
        stop=stop_after_attempt(25),
        wait=wait_exponential(multiplier=1, min=1, max=60),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    def _connect_with_retry(self):
        """Connect to PostgreSQL with exponential backoff (1s-60s, 25 attempts)."""
        log.info("db.connecting", url=self.db_url[:30] + "...")
        self.conn = psycopg2.connect(self.db_url)
        self.conn.autocommit = True
        log.info("db.connected")

    def _ensure_connection(self):
        """Reconnect if the connection is closed or broken."""
        if self.conn is None or self.conn.closed:
            log.info("db.reconnecting", reason="connection_closed")
            self._connect_with_retry()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        retry=retry_if_exception_type(psycopg2.OperationalError),
        reraise=True,
    )
    def update_job_status(self, job_id, status):
        """Update the status of a document/job."""
        self._ensure_connection()
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "UPDATE documents SET status = %s WHERE id = %s",
                    (status, job_id),
                )
            log.info("db.status_updated", job_id=job_id, status=status)
        except psycopg2.OperationalError:
            self.conn = None
            raise

    def update_progress(self, job_id, phase, translated_count=None, total_count=None):
        """Update pipeline progress for a job."""
        self._ensure_connection()
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE documents
                    SET pipeline_phase = %s,
                        translated_count = COALESCE(%s, translated_count),
                        total_count = COALESCE(%s, total_count)
                    WHERE id = %s
                    """,
                    (phase, translated_count, total_count, job_id),
                )
            log.info(
                "db.progress_updated",
                job_id=job_id,
                phase=phase,
                translated=translated_count,
                total=total_count,
            )
        except psycopg2.OperationalError:
            self.conn = None
            raise

    def update_error(self, job_id, error_code, error_message):
        """Store error details for a failed job."""
        self._ensure_connection()
        error_detail = json.dumps({"code": error_code, "message": error_message})
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE documents
                    SET error_detail = %s::jsonb, status = 'FAILED'
                    WHERE id = %s
                    """,
                    (error_detail, job_id),
                )
            log.error(
                "db.error_stored",
                job_id=job_id,
                code=error_code,
                message=error_message,
            )
        except psycopg2.OperationalError:
            self.conn = None
            raise

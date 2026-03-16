"""Tests for progress tracking (WRK-04, WRK-05)."""

import json
from unittest.mock import MagicMock, patch

import pytest

from pipeline.models import Document


def test_document_model_has_progress_fields():
    """Document model should have pipeline_phase, translated_count, total_count, error_detail."""
    assert hasattr(Document, "pipeline_phase")
    assert hasattr(Document, "translated_count")
    assert hasattr(Document, "total_count")
    assert hasattr(Document, "error_detail")


def test_progress_update_method():
    """DBService.update_progress calls correct SQL."""
    with patch("psycopg2.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        from services.db import DBService

        db = DBService("postgresql://localhost/test")
        db.update_progress("job-1", "translating", translated_count=10, total_count=50)

        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        assert "pipeline_phase" in call_args[0][0]
        assert "translated_count" in call_args[0][0]
        assert call_args[0][1] == ("translating", 10, 50, "job-1")


def test_error_detail_stored_as_json():
    """DBService.update_error stores structured error detail as JSON."""
    with patch("psycopg2.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        from services.db import DBService

        db = DBService("postgresql://localhost/test")
        db.update_error("job-1", "LLM_AUTH_FAILED", "Invalid API key for OpenAI")

        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        assert "error_detail" in call_args[0][0]
        assert "FAILED" in call_args[0][0]
        # Verify JSON structure
        error_json = call_args[0][1][0]
        parsed = json.loads(error_json)
        assert parsed["code"] == "LLM_AUTH_FAILED"
        assert "Invalid API key" in parsed["message"]


def test_pipeline_sets_phase():
    """run_pipeline accepts db_service and shutdown_event parameters."""
    import inspect
    from pipeline.pipeline import run_pipeline

    sig = inspect.signature(run_pipeline)
    assert "db_service" in sig.parameters
    assert "shutdown_event" in sig.parameters

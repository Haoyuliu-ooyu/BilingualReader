"""Tests for progress tracking (WRK-04, WRK-05)."""

import pytest

from pipeline.models import Document


def test_document_model_has_progress_fields():
    """Document model should have pipeline_phase, translated_count, total_count, error_detail."""
    assert hasattr(Document, "pipeline_phase")
    assert hasattr(Document, "translated_count")
    assert hasattr(Document, "total_count")
    assert hasattr(Document, "error_detail")


@pytest.mark.skip(reason="Implemented in plan 03")
def test_progress_update_method():
    """Progress updates should write to DB correctly."""
    pass


@pytest.mark.skip(reason="Implemented in plan 03")
def test_error_detail_stored_as_json():
    """Error details should be stored as JSONB in the database."""
    pass

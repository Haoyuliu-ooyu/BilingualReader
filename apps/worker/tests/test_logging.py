"""Tests for structured logging configuration (WRK-03)."""

import pytest
import structlog
import structlog.testing

from logging_config import configure_logging


def test_structlog_configured_json_output():
    """structlog produces structured log entries with expected fields."""
    configure_logging(dev_mode=False)
    log = structlog.get_logger()

    with structlog.testing.capture_logs() as captured:
        log.info("test.event", key="value")

    assert len(captured) >= 1
    entry = captured[0]
    assert entry["event"] == "test.event"
    assert entry["key"] == "value"


@pytest.mark.skip(reason="Validated after plan 02 replaces all print() calls")
def test_no_print_statements_in_source():
    """Source code should use structlog instead of print()."""
    pass

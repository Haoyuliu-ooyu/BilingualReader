"""Tests for structured logging configuration (WRK-03)."""

import ast
import os

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


def test_no_print_in_infrastructure_files():
    """Verify infrastructure files use structlog, not print()."""
    files = ["main.py", "services/queue.py", "services/db.py", "pipeline/pipeline.py"]
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for f in files:
        path = os.path.join(base, f)
        with open(path) as fh:
            tree = ast.parse(fh.read())
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "print"
            ):
                raise AssertionError(
                    f"{f} contains print() call at line {node.lineno}"
                )

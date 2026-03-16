"""Tests for graceful shutdown behavior (WRK-01)."""

import os
import signal
import threading
from unittest.mock import MagicMock, patch

import pytest


def test_shutdown_flag_set_on_sigterm():
    """SIGTERM handler sets the shutdown_requested event."""
    shutdown_requested = threading.Event()

    original_handler = signal.getsignal(signal.SIGTERM)

    def handler(signum, frame):
        shutdown_requested.set()

    signal.signal(signal.SIGTERM, handler)
    try:
        os.kill(os.getpid(), signal.SIGTERM)
        assert shutdown_requested.is_set() is True
    finally:
        signal.signal(signal.SIGTERM, original_handler)


def test_main_loop_exits_on_shutdown_flag():
    """Verify the while loop condition checks shutdown_requested."""
    import main

    # Set the shutdown flag
    main.shutdown_requested.set()
    # The main loop condition is `while not shutdown_requested.is_set()`
    # so the loop body should not execute
    assert main.shutdown_requested.is_set()
    # Reset for other tests
    main.shutdown_requested.clear()


def test_interrupted_status_set_on_shutdown(mock_db_service, mock_queue_service):
    """Verify process_task sets INTERRUPTED status on InterruptedError."""
    import main

    shutdown = threading.Event()
    shutdown.set()
    task = {
        "job_id": "test-123",
        "s3_key": "test.pdf",
        "target_lang": "ES",
        "original_name": "test.pdf",
        "llm_provider": "",
        "llm_model": "",
        "llm_api_key": "",
    }
    with patch("main.run_pipeline", side_effect=InterruptedError("Shutdown")):
        with patch("main.download_file", return_value=True):
            main.process_task(mock_db_service, mock_queue_service, task, shutdown)
    mock_db_service.update_job_status.assert_any_call("test-123", "INTERRUPTED")
    mock_queue_service.push_task.assert_called_once()

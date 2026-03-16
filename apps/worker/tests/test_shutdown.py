"""Tests for graceful shutdown behavior (WRK-01)."""

import os
import signal
import threading

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


@pytest.mark.skip(reason="Implemented in plan 02")
def test_main_loop_exits_on_shutdown_flag():
    """Main loop should exit when shutdown flag is set."""
    pass


@pytest.mark.skip(reason="Implemented in plan 02")
def test_interrupted_status_set_on_shutdown():
    """Active job should be marked as INTERRUPTED on shutdown."""
    pass

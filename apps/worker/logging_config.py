"""Structured logging configuration using structlog.

Produces JSON output in production, human-readable console output in dev mode.
"""

import logging
import os
import sys

import structlog


def configure_logging(dev_mode: bool = None) -> None:
    """Configure structlog for the worker process.

    Args:
        dev_mode: If True, use ConsoleRenderer for human-readable output.
                  If False, use JSONRenderer for machine-parseable output.
                  Defaults to DEV_MODE environment variable.
    """
    if dev_mode is None:
        dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if dev_mode:
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

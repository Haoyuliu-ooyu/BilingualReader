"""Shared test fixtures for worker tests."""

import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# Ensure apps/worker is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def mock_db_service():
    """Mock DBService with standard methods."""
    mock = MagicMock()
    mock.update_job_status = MagicMock()
    mock.update_progress = MagicMock()
    mock.update_error = MagicMock()
    mock.save_translation = MagicMock()
    return mock


@pytest.fixture
def mock_queue_service():
    """Mock QueueService with standard methods and attributes."""
    mock = MagicMock()
    mock.get_task = MagicMock(return_value=None)
    mock.push_task = MagicMock()
    mock.client = MagicMock()
    return mock


@pytest.fixture
def mock_llm_client():
    """Mock LLMClient with generate method and config."""
    mock = MagicMock()
    mock.generate = MagicMock(return_value="mock response")
    mock.config = MagicMock()
    mock.config.provider = "openai"
    mock.config.model = "gpt-4o"
    return mock

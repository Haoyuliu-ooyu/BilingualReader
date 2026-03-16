"""Tests for LLM error hierarchy (WRK-06)."""

import pytest

from errors import (
    LLMError,
    LLMAuthError,
    LLMRateLimitError,
    LLMContentPolicyError,
    LLMTransientError,
)


def test_llm_auth_error_is_llm_error():
    """LLMAuthError inherits from LLMError and stores provider."""
    e = LLMAuthError("bad key", "openai")
    assert isinstance(e, LLMError)
    assert e.provider == "openai"


def test_llm_rate_limit_error_is_llm_error():
    """LLMRateLimitError inherits from LLMError and stores provider."""
    e = LLMRateLimitError("too many requests", "gemini")
    assert isinstance(e, LLMError)
    assert e.provider == "gemini"


def test_llm_content_policy_error_is_llm_error():
    """LLMContentPolicyError inherits from LLMError and stores provider."""
    e = LLMContentPolicyError("content refused", "claude")
    assert isinstance(e, LLMError)
    assert e.provider == "claude"


def test_llm_transient_error_is_llm_error():
    """LLMTransientError inherits from LLMError and stores provider."""
    e = LLMTransientError("server error", "openai")
    assert isinstance(e, LLMError)
    assert e.provider == "openai"


def test_llm_error_stores_original_error():
    """LLMError subclasses preserve the original exception."""
    orig = ValueError("original cause")
    e = LLMAuthError("msg", "gemini", orig)
    assert e.original_error is orig


@pytest.mark.skip(reason="Implemented in plan 03")
def test_auth_error_not_retried():
    """Auth errors should not be retried."""
    pass


@pytest.mark.skip(reason="Implemented in plan 03")
def test_rate_limit_error_retried_with_backoff():
    """Rate limit errors should be retried with exponential backoff."""
    pass

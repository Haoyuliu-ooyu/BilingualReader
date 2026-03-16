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


def test_auth_error_not_retried():
    """LLMAuthError should NOT be retried by translator.call_llm."""
    from unittest.mock import MagicMock

    from pipeline.translator import TranslationAgent

    mock_session = MagicMock()
    mock_llm = MagicMock()
    mock_llm.generate.side_effect = LLMAuthError("bad key", "openai")

    agent = TranslationAgent(mock_session, llm_client=mock_llm)
    chunk = [{"seg_id": "1", "original_text": "hello"}]

    with pytest.raises(LLMAuthError):
        agent.call_llm(chunk, {}, "ES")

    # Should be called exactly once -- no retry
    assert mock_llm.generate.call_count == 1


def test_rate_limit_retried_via_predicate():
    """Verify retry predicate includes LLMRateLimitError and LLMTransientError but not LLMAuthError."""
    from unittest.mock import MagicMock
    from tenacity import retry_if_exception_type, RetryCallState, Future

    predicate = retry_if_exception_type((LLMRateLimitError, LLMTransientError))

    def make_retry_state(exc):
        """Build a RetryCallState with the given exception as outcome."""
        rs = MagicMock(spec=RetryCallState)
        outcome = MagicMock()
        outcome.failed = True
        outcome.exception.return_value = exc
        rs.outcome = outcome
        return rs

    assert predicate(make_retry_state(LLMRateLimitError("test", "openai")))
    assert predicate(make_retry_state(LLMTransientError("test", "openai")))
    assert not predicate(make_retry_state(LLMAuthError("test", "openai")))


def test_content_policy_error_not_retried():
    """LLMContentPolicyError should NOT be retried by translator.call_llm."""
    from unittest.mock import MagicMock

    from pipeline.translator import TranslationAgent

    mock_session = MagicMock()
    mock_llm = MagicMock()
    mock_llm.generate.side_effect = LLMContentPolicyError("blocked", "openai")

    agent = TranslationAgent(mock_session, llm_client=mock_llm)
    chunk = [{"seg_id": "1", "original_text": "hello"}]

    with pytest.raises(LLMContentPolicyError):
        agent.call_llm(chunk, {}, "ES")

    assert mock_llm.generate.call_count == 1

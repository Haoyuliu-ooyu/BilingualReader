"""LLM error hierarchy for structured error handling and retry logic.

Each error type maps to a specific recovery strategy:
- Auth errors: Fatal, no retry
- Rate limit errors: Retry with backoff
- Content policy errors: Skip chunk, continue
- Transient errors: Retry with backoff
"""


class LLMError(Exception):
    """Base class for all LLM-related errors."""

    def __init__(self, message: str, provider: str, original_error: Exception = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.original_error = original_error


class LLMAuthError(LLMError):
    """401/403 - Invalid or expired API key. Fatal, no retry."""
    pass


class LLMRateLimitError(LLMError):
    """429 - Rate limit exceeded. Transient, retry with backoff."""
    pass


class LLMContentPolicyError(LLMError):
    """Content refused by model safety filters. Skip chunk, continue."""
    pass


class LLMTransientError(LLMError):
    """5xx, timeout, connection error. Transient, retry with backoff."""
    pass

"""
Unified LLM client that abstracts OpenAI, Google Gemini, and Anthropic Claude
behind a single interface. Accepts provider/model/api_key from the job payload
so the worker uses the user's chosen configuration rather than hardcoded env vars.
"""

import json
from dataclasses import dataclass

import structlog
import openai
from google import genai
from google.genai.errors import APIError as GeminiAPIError
import anthropic

from errors import LLMAuthError, LLMRateLimitError, LLMContentPolicyError, LLMTransientError

log = structlog.get_logger("worker.llm")


@dataclass
class LLMConfig:
    provider: str   # "openai", "gemini", or "claude"
    model: str      # e.g. "gpt-4o", "gemini-2.0-flash", "claude-sonnet-4-6"
    api_key: str    # plaintext (decrypted by caller)


class LLMClient:
    """Thin wrapper: send a system prompt + user message, get back text."""

    def __init__(self, config: LLMConfig):
        self.config = config

        if config.provider == "openai":
            self.openai = openai.OpenAI(api_key=config.api_key)
        elif config.provider == "gemini":
            self.gemini = genai.Client(api_key=config.api_key)
        elif config.provider == "claude":
            self.anthropic = anthropic.Anthropic(api_key=config.api_key)
        else:
            raise ValueError(f"Unsupported LLM provider: {config.provider}")

    def generate(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 4096,
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> str:
        """Returns the raw text response from the chosen provider.

        When json_mode=True, providers that support structured JSON output
        (OpenAI, Gemini) are configured to enforce valid JSON responses.
        """
        if self.config.provider == "openai":
            return self._call_openai(system_prompt, user_message, max_tokens, temperature, json_mode)
        elif self.config.provider == "gemini":
            return self._call_gemini(system_prompt, user_message, max_tokens, temperature, json_mode)
        elif self.config.provider == "claude":
            return self._call_claude(system_prompt, user_message, max_tokens, temperature)

    # ------------------------------------------------------------------
    def _call_openai(self, system: str, user: str, max_tokens: int, temperature: float, json_mode: bool) -> str:
        kwargs = dict(
            model=self.config.model,
            max_completion_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            resp = self.openai.chat.completions.create(**kwargs)
            finish_reason = resp.choices[0].finish_reason if resp.choices else None
            log.debug("llm.openai_response", max_tokens=max_tokens, finish_reason=finish_reason)

            if finish_reason == "length":
                log.warning("llm.transient_error", provider="openai", error="output_truncated",
                            max_tokens=max_tokens)
                raise LLMTransientError(
                    f"Output truncated (hit {max_tokens} token limit)", "openai", None)

            text = resp.choices[0].message.content
            if text is None:
                raise LLMTransientError("Empty response from model", "openai", None)
            return text.strip()
        except openai.AuthenticationError as e:
            log.warning("llm.auth_error", provider="openai", error=str(e))
            raise LLMAuthError("Invalid API key", "openai", e)
        except openai.PermissionDeniedError as e:
            log.warning("llm.auth_error", provider="openai", error=str(e))
            raise LLMAuthError("Permission denied", "openai", e)
        except openai.RateLimitError as e:
            log.warning("llm.rate_limit", provider="openai", error=str(e))
            raise LLMRateLimitError("Rate limit exceeded", "openai", e)
        except openai.BadRequestError as e:
            if "content_policy" in str(e).lower() or "safety" in str(e).lower():
                log.warning("llm.content_policy", provider="openai", error=str(e))
                raise LLMContentPolicyError("Content blocked by policy", "openai", e)
            log.warning("llm.transient_error", provider="openai", error=str(e))
            raise LLMTransientError(str(e), "openai", e)
        except (openai.APIConnectionError, openai.InternalServerError) as e:
            log.warning("llm.transient_error", provider="openai", error=str(e))
            raise LLMTransientError(str(e), "openai", e)

    def _call_gemini(self, system: str, user: str, max_tokens: int, temperature: float, json_mode: bool) -> str:
        from google.genai import types

        config_kwargs = dict(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=temperature,
            automatic_function_calling={"disable": True},
        )
        if json_mode:
            config_kwargs["response_mime_type"] = "application/json"

        try:
            resp = self.gemini.models.generate_content(
                model=self.config.model,
                contents=user,
                config=types.GenerateContentConfig(**config_kwargs),
            )

            # Check finish reason for safety/content blocks
            finish_reason = None
            if resp.candidates:
                fr = resp.candidates[0].finish_reason
                if fr is not None:
                    finish_reason = fr.name if hasattr(fr, "name") else str(fr)
            
            log.debug("llm.gemini_response", max_output_tokens=max_tokens, finish_reason=finish_reason)

            if finish_reason and finish_reason in ("SAFETY", "RECITATION"):
                log.warning("llm.content_policy", provider="gemini", finish_reason=finish_reason)
                raise LLMContentPolicyError(
                    f"Content blocked: finish_reason={finish_reason}", "gemini", None)

            if finish_reason and finish_reason == "MAX_TOKENS":
                log.warning("llm.transient_error", provider="gemini", error="output_truncated", resp_repr=repr(resp))
                raise LLMTransientError(
                    f"Output truncated (hit {max_tokens} token limit)", "gemini", None)

            text = resp.text
            if text is None:
                log.error("llm.gemini_empty", resp_repr=repr(resp))
                raise LLMTransientError("Empty response from model", "gemini", None)
            return text.strip()
        except LLMContentPolicyError:
            raise  # re-raise already-classified errors
        except LLMTransientError:
            raise  # re-raise already-classified errors
        except GeminiAPIError as e:
            if e.code in (401, 403):
                log.warning("llm.auth_error", provider="gemini", error=str(e))
                raise LLMAuthError("Invalid API key", "gemini", e)
            elif e.code == 429:
                log.warning("llm.rate_limit", provider="gemini", error=str(e))
                raise LLMRateLimitError("Rate limit exceeded", "gemini", e)
            elif e.code >= 500:
                log.warning("llm.transient_error", provider="gemini", error=str(e))
                raise LLMTransientError(str(e), "gemini", e)
            elif e.code == 400:
                if "safety" in str(e).lower() or "content" in str(e).lower():
                    log.warning("llm.content_policy", provider="gemini", error=str(e))
                    raise LLMContentPolicyError("Content blocked", "gemini", e)
                log.warning("llm.transient_error", provider="gemini", error=str(e))
                raise LLMTransientError(str(e), "gemini", e)
            log.warning("llm.transient_error", provider="gemini", error=str(e))
            raise LLMTransientError(str(e), "gemini", e)

    def _call_claude(self, system: str, user: str, max_tokens: int, temperature: float) -> str:
        try:
            resp = self.anthropic.messages.create(
                model=self.config.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            log.debug("llm.claude_response", max_tokens=max_tokens, stop_reason=resp.stop_reason)

            if resp.stop_reason == "max_tokens":
                log.warning("llm.transient_error", provider="claude", error="output_truncated",
                            max_tokens=max_tokens)
                raise LLMTransientError(
                    f"Output truncated (hit {max_tokens} token limit)", "claude", None)

            text = resp.content[0].text if resp.content else None
            if text is None:
                raise LLMTransientError("Empty response from model", "claude", None)
            return text.strip()
        except anthropic.AuthenticationError as e:
            log.warning("llm.auth_error", provider="claude", error=str(e))
            raise LLMAuthError("Invalid API key", "claude", e)
        except anthropic.PermissionDeniedError as e:
            log.warning("llm.auth_error", provider="claude", error=str(e))
            raise LLMAuthError("Permission denied", "claude", e)
        except anthropic.RateLimitError as e:
            log.warning("llm.rate_limit", provider="claude", error=str(e))
            raise LLMRateLimitError("Rate limit exceeded", "claude", e)
        except anthropic.BadRequestError as e:
            if "content" in str(e).lower() and ("policy" in str(e).lower() or "safety" in str(e).lower()):
                log.warning("llm.content_policy", provider="claude", error=str(e))
                raise LLMContentPolicyError("Content blocked by policy", "claude", e)
            log.warning("llm.transient_error", provider="claude", error=str(e))
            raise LLMTransientError(str(e), "claude", e)
        except (anthropic.APIConnectionError, anthropic.InternalServerError) as e:
            log.warning("llm.transient_error", provider="claude", error=str(e))
            raise LLMTransientError(str(e), "claude", e)

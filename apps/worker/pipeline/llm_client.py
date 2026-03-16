"""
Unified LLM client that abstracts OpenAI, Google Gemini, and Anthropic Claude
behind a single interface. Accepts provider/model/api_key from the job payload
so the worker uses the user's chosen configuration rather than hardcoded env vars.
"""

import json
from dataclasses import dataclass

import openai
from google import genai
import anthropic


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
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = self.openai.chat.completions.create(**kwargs)
        return resp.choices[0].message.content.strip()

    def _call_gemini(self, system: str, user: str, max_tokens: int, temperature: float, json_mode: bool) -> str:
        from google.genai import types

        config_kwargs = dict(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=temperature,
        )
        if json_mode:
            config_kwargs["response_mime_type"] = "application/json"

        resp = self.gemini.models.generate_content(
            model=self.config.model,
            contents=user,
            config=types.GenerateContentConfig(**config_kwargs),
        )

        # Log finish reason for debugging truncation issues
        finish_reason = None
        if resp.candidates:
            finish_reason = resp.candidates[0].finish_reason
        print(f"[Gemini] max_output_tokens={max_tokens}, finish_reason={finish_reason}")

        if finish_reason and str(finish_reason) == "MAX_TOKENS":
            raise Exception(
                f"Gemini output truncated (hit {max_tokens} token limit). "
                "Increase max_tokens or reduce chunk size."
            )

        return resp.text.strip()

    def _call_claude(self, system: str, user: str, max_tokens: int, temperature: float) -> str:
        resp = self.anthropic.messages.create(
            model=self.config.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text.strip()

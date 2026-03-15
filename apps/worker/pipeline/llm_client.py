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
    ) -> str:
        """Returns the raw text response from the chosen provider."""
        if self.config.provider == "openai":
            return self._call_openai(system_prompt, user_message, max_tokens, temperature)
        elif self.config.provider == "gemini":
            return self._call_gemini(system_prompt, user_message, max_tokens, temperature)
        elif self.config.provider == "claude":
            return self._call_claude(system_prompt, user_message, max_tokens, temperature)

    # ------------------------------------------------------------------
    def _call_openai(self, system: str, user: str, max_tokens: int, temperature: float) -> str:
        resp = self.openai.chat.completions.create(
            model=self.config.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return resp.choices[0].message.content.strip()

    def _call_gemini(self, system: str, user: str, max_tokens: int, temperature: float) -> str:
        combined = f"{system}\n\n{user}"
        resp = self.gemini.models.generate_content(
            model=self.config.model,
            contents=combined,
            config={
                "max_output_tokens": max_tokens,
                "temperature": temperature,
            },
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

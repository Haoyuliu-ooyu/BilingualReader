---
status: awaiting_human_verify
trigger: "Translation worker fails to parse LLM (Anthropic Claude) output as JSON - truncated response"
created: 2026-03-18T00:00:00Z
updated: 2026-03-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — _call_claude missing stop_reason check
test: Fix applied, awaiting human verification
expecting: Truncated responses now raise LLMTransientError instead of returning invalid JSON
next_action: Request human verification of the fix

## Symptoms

expected: LLM returns valid JSON with translated segments that can be parsed by the worker
actual: LLM returns truncated JSON — translated_text value cut off mid-content (no closing quote/braces). Raw output starts with garbage like `= { §igne |`
errors:
- "Expecting ',' delimiter: line 5 column 1313 (char 1389)"
- "Expecting ',' delimiter: line 5 column 1241 (char 1317)"
- "Failed to parse LLM output" (translator.parse_error, translator.chunk_failed)
- "Translation incomplete: 8/10 segments untranslated" after 3 passes
reproduction: Happens when translating academic/art history content (Gauguin/Brittany) via Anthropic Claude API. Translated text contains long Chinese text that gets truncated.
started: Observed in logs 2026-03-17. HTTP 200 from API, so not an API error — response content is truncated.

## Eliminated

## Evidence

- timestamp: 2026-03-18T00:01:00Z
  checked: llm_client.py _call_claude method (lines 162-192)
  found: _call_claude does NOT check resp.stop_reason. Compare to _call_gemini (lines 130-133) which explicitly checks finish_reason == "MAX_TOKENS" and raises LLMTransientError. Claude path silently returns truncated text.
  implication: When Claude hits max_tokens, the truncated JSON passes through to the translator's json.loads() which then fails with "Expecting ',' delimiter"

- timestamp: 2026-03-18T00:01:00Z
  checked: llm_client.py generate method (line 61)
  found: json_mode parameter is accepted by generate() but NOT forwarded to _call_claude(). The method signature on line 162 doesn't include json_mode. This is cosmetic since Claude API doesn't have native JSON mode, but confirms Claude gets no special JSON handling.
  implication: Secondary issue — Claude gets no JSON-specific configuration

- timestamp: 2026-03-18T00:01:00Z
  checked: translator.py call_llm max_tokens estimation (lines 58-65)
  found: tokens_per_word=8 for CJK, with json_overhead=80*len(chunk), plus 256 buffer. For dense academic content with long translations, this estimate could still be tight. But the ROOT issue is that truncation is not detected.
  implication: Even with generous token estimates, without truncation detection the bug will recur for edge cases

- timestamp: 2026-03-18T00:03:00Z
  checked: Anthropic SDK Message type fields
  found: stop_reason field confirmed with type Optional[Literal['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn', 'refusal']]. "max_tokens" is the value when output is truncated.
  implication: Hypothesis confirmed — the field exists and is not checked

- timestamp: 2026-03-18T00:03:00Z
  checked: _call_openai truncation handling
  found: OpenAI path also lacks finish_reason check. OpenAI uses finish_reason="length" for truncation. Same gap as Claude.
  implication: Fixed both providers to prevent same bug from occurring with OpenAI

- timestamp: 2026-03-18T00:04:00Z
  checked: Error propagation — LLMTransientError raised inside try/except blocks
  found: All except clauses catch SDK-specific exceptions (anthropic.*, openai.*). LLMTransientError inherits from LLMError -> Exception, not from any SDK class. It propagates correctly without being caught/re-wrapped.
  implication: Fix is safe — truncation error will propagate to translator retry logic correctly

## Resolution

root_cause: _call_claude() in llm_client.py does not check the Anthropic API response's stop_reason field. When the response is truncated due to hitting max_tokens, the method returns the truncated text (invalid JSON) without raising an error. The Gemini path has this check (line 130-133) but Claude path was never given equivalent logic. This causes json.loads() to fail in translator.py with "Expecting ',' delimiter" because the JSON is cut off mid-value.
fix: |
  1. Added stop_reason == "max_tokens" check in _call_claude() (llm_client.py) — raises LLMTransientError on truncation, matching existing Gemini behavior
  2. Added finish_reason == "length" check in _call_openai() (llm_client.py) — same fix for OpenAI path which had identical gap
  3. Increased token estimation in translator.py: tokens_per_word 8->10 for CJK, 3->4 for non-CJK, added 1.5x safety multiplier and increased buffer 256->512
verification: Awaiting human verification — run translation pipeline with Anthropic Claude on academic content
files_changed:
  - apps/worker/pipeline/llm_client.py
  - apps/worker/pipeline/translator.py

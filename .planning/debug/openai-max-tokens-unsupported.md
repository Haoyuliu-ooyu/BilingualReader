---
status: awaiting_human_verify
trigger: "OpenAI API returns 400 error because the worker sends max_tokens parameter which newer OpenAI models (5.4+) don't support"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:00:00Z
---

## Current Focus

hypothesis: _call_openai in llm_client.py passes `max_tokens` kwarg which newer OpenAI models reject; must use `max_completion_tokens`
test: Change parameter name in OpenAI call only
expecting: OpenAI calls succeed with newer models
next_action: Apply fix to _call_openai method

## Symptoms

expected: OpenAI API calls succeed with proper token limit parameter
actual: 400 Bad Request - "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."
errors: Error code: 400 - {'error': {'message': "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", 'type': 'invalid_request_error', 'param': 'max_tokens', 'code': 'unsupported_parameter'}}
reproduction: Send any translation job using OpenAI provider with a newer model
started: Started with OpenAI 5.4 API / newer models that deprecated max_tokens

## Eliminated

## Evidence

- timestamp: 2026-03-23T00:00:00Z
  checked: apps/worker/pipeline/llm_client.py line 67
  found: `_call_openai` builds kwargs with `max_tokens=max_tokens` on line 67
  implication: This is the exact parameter OpenAI's newer models reject. Must be `max_completion_tokens`.

- timestamp: 2026-03-23T00:00:00Z
  checked: Other providers in same file
  found: Gemini uses `max_output_tokens` (line 115), Claude uses `max_tokens` (line 180) - both correct for their APIs
  implication: Fix is provider-specific to OpenAI only

- timestamp: 2026-03-23T00:00:00Z
  checked: requirements.txt
  found: openai package has no version pin
  implication: Will pick up latest SDK which supports max_completion_tokens

## Resolution

root_cause: `_call_openai` method passes `max_tokens` parameter which newer OpenAI models (5.4+) reject. The OpenAI API now requires `max_completion_tokens` instead.
fix: Replace `max_tokens` with `max_completion_tokens` in the OpenAI kwargs dict (line 67 of llm_client.py)
verification: All 19 worker tests pass. Change is isolated to OpenAI kwargs dict only.
files_changed: [apps/worker/pipeline/llm_client.py]

---
phase: 02-worker-resilience
plan: 03
subsystem: worker
tags: [llm, retry, error-handling, structlog, tenacity, progress-tracking]

# Dependency graph
requires:
  - phase: 02-01
    provides: "LLM error hierarchy (errors.py) and structlog configuration"
  - phase: 02-02
    provides: "DBService with update_progress/update_error, shutdown_event plumbing"
provides:
  - "Exception wrapping for OpenAI, Gemini, and Claude providers"
  - "Smart retry that only retries transient/rate-limit errors"
  - "Content policy skip logic in translator chunk loop"
  - "Granular progress reporting (pipeline_phase, translated_count/total_count)"
  - "Structured error detail propagation (LLM_AUTH_FAILED, LLM_RATE_LIMITED, PIPELINE_ERROR)"
affects: [02-04, 03-translation-quality, 04-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-exception-wrapping, smart-retry-predicate, progress-callback-pattern]

key-files:
  created: []
  modified:
    - apps/worker/pipeline/llm_client.py
    - apps/worker/pipeline/translator.py
    - apps/worker/pipeline/context_agent.py
    - apps/worker/pipeline/pipeline.py
    - apps/worker/main.py
    - apps/worker/tests/test_error_classification.py
    - apps/worker/tests/test_progress.py

key-decisions:
  - "Incomplete LLM responses raise LLMTransientError (retryable) instead of generic Exception"
  - "Parse errors in translator raise LLMTransientError to allow retry with different tokenization"
  - "Gemini SAFETY and RECITATION finish_reasons both map to LLMContentPolicyError"

patterns-established:
  - "Provider exception wrapping: each _call_* method maps provider-specific exceptions to LLM error hierarchy"
  - "Smart retry predicate: retry_if_exception_type((LLMRateLimitError, LLMTransientError)) replaces blanket Exception retry"
  - "Progress callback: pipeline passes on_progress closure to TranslationAgent for per-chunk DB updates"

requirements-completed: [WRK-04, WRK-05, WRK-06]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 02 Plan 03: Error Classification and Progress Summary

**LLM exception wrapping for 3 providers with smart retry predicates, content policy skip, and per-chunk progress reporting to DB**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T19:05:19Z
- **Completed:** 2026-03-16T19:11:30Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- All 3 LLM providers (OpenAI, Gemini, Claude) now have exception wrapping that maps provider-specific errors to the LLM error hierarchy
- Auth errors (401/403) fail immediately without retry; rate limits and transient errors retry up to 5 times with exponential backoff
- Content policy violations skip the blocked chunk and continue translating remaining chunks
- Pipeline reports phase transitions (extracting, generating_context, translating) and per-chunk progress (translated_count/total_count) to the database
- Failed documents get structured error_detail JSON with code and message
- All print() statements replaced with structlog across llm_client, translator, and context_agent

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap LLM provider exceptions and update retry predicates** - `8dd9eac` (feat)
2. **Task 2: Wire progress reporting in pipeline and propagate errors to DB** - `9412332` (feat)
3. **Task 3: Unskip and implement remaining tests for error classification and progress** - `3e6f0b6` (test)

## Files Created/Modified
- `apps/worker/pipeline/llm_client.py` - Exception wrapping for OpenAI, Gemini, Claude with structlog
- `apps/worker/pipeline/translator.py` - Smart retry, shutdown_event, progress_callback, content policy skip
- `apps/worker/pipeline/context_agent.py` - Smart retry replacing blanket Exception retry
- `apps/worker/pipeline/pipeline.py` - db_service parameter, phase progress, on_progress callback, total_segments count
- `apps/worker/main.py` - Specific error handlers for LLMAuthError/LLMRateLimitError, db_service passthrough
- `apps/worker/tests/test_error_classification.py` - 8 tests including auth not retried, predicate validation, content policy not retried
- `apps/worker/tests/test_progress.py` - 4 tests including progress SQL params, error JSON structure, pipeline signature

## Decisions Made
- Incomplete LLM responses (missing segments) now raise LLMTransientError instead of generic Exception, making them retryable
- JSON parse errors in translator also raise LLMTransientError to allow retry
- Gemini SAFETY and RECITATION finish_reasons both treated as content policy errors
- Rate limit retry predicate test uses mock RetryCallState instead of slow actual retries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incomplete response and parse error exception types**
- **Found during:** Task 1 (translator.py update)
- **Issue:** Plan did not specify what exception type to raise for incomplete LLM responses (missing segments) or JSON parse errors in the translator
- **Fix:** Changed from generic Exception to LLMTransientError so these are retryable
- **Files modified:** apps/worker/pipeline/translator.py
- **Verification:** Import check passes, tests pass
- **Committed in:** 8dd9eac (Task 1 commit)

**2. [Rule 1 - Bug] Fixed retry predicate test approach**
- **Found during:** Task 3 (test implementation)
- **Issue:** tenacity retry_if_exception_type callable expects a RetryCallState, not a raw exception
- **Fix:** Created mock RetryCallState objects with proper outcome attributes
- **Files modified:** apps/worker/tests/test_error_classification.py
- **Verification:** All tests pass
- **Committed in:** 3e6f0b6 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Worker Python dependencies not installed locally; installed via pip3 before running verification

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error classification, smart retry, and progress reporting complete
- Plan 02-04 can build on this for end-to-end integration testing
- Frontend can now poll pipeline_phase and translated_count/total_count for progress display

---
*Phase: 02-worker-resilience*
*Completed: 2026-03-16*

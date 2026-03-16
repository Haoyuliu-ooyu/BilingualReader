# Phase 2: Worker Resilience - Research

**Researched:** 2026-03-16
**Domain:** Python worker process resilience (signal handling, reconnection, error classification, structured logging, pipeline improvements)
**Confidence:** HIGH

## Summary

This phase transforms the Python worker from a fragile single-loop consumer into a resilient service that handles real-world failure modes. The existing codebase has minimal error handling: QueueService has zero reconnect logic, all exceptions trigger tenacity retries identically, status reporting is binary (PROCESSING/COMPLETED/FAILED), and all output uses `print()`. The worker also needs pipeline improvements: genre-aware context generation, OCR fallback for scanned PDFs, and smarter chunk boundaries.

The Python ecosystem provides mature, well-maintained libraries for every requirement. `structlog` (v25.x) handles structured JSON logging. `tenacity` (already a dependency) supports custom retry predicates for error classification. `redis-py` (already a dependency) has built-in `Retry` and `ExponentialBackoff` classes. Python's `signal` module handles SIGTERM/SIGINT with a flag-based pattern for graceful shutdown. All three LLM SDKs (openai, anthropic, google-genai) expose typed exception hierarchies that map cleanly to the fatal/transient/content-policy classification decided in CONTEXT.md.

**Primary recommendation:** Implement changes in layers -- structured logging first (touches every file), then infrastructure resilience (signals, reconnection), then error classification and progress reporting, and finally pipeline improvements (context agent, extraction, chunking).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- On SIGTERM mid-translation: finish current chunk, save its translations, then re-queue remaining untranslated segments as a new job to Redis
- On SIGTERM while idle (BLPOP wait): exit immediately, interrupt the BLPOP
- New DB status `INTERRUPTED` distinguishes "killed mid-work" from "failed"
- Signal handling via Python `signal` module in the main loop
- Content policy violations: skip blocked chunk, mark segments as `blocked`, continue translating rest
- Transient errors (429, timeout, 5xx): 5 retries with exponential backoff via tenacity (~3 minutes)
- Fatal errors (401 auth, invalid API key): fail immediately, no retry
- Error reasons stored as structured error codes + message (e.g., `{code: "LLM_AUTH_FAILED", message: "..."}`)
- Progress updates after each chunk completes, stored as `translated_count` / `total_count`
- Report pipeline phases: `extracting` -> `generating_context` -> `translating`
- Redis reconnect: exponential backoff 1s-60s, exit non-zero after ~5 minutes; Docker restart handles recovery
- PostgreSQL reconnect: match Redis pattern with same backoff strategy
- Context agent: two-call approach (genre classify then genre-specific extraction)
- Genre types: fiction, technical, legal, academic, general
- Explicit name->translation mapping table as first-class context output
- OCR fallback when PyMuPDF returns 0 text blocks
- Quality check after extraction (garbled text detection)
- Chunk boundaries: split at paragraph/section boundaries instead of pure segment count
- Replace all print() with structlog (JSON output)
- Rename "World Bible" to genre-neutral term (e.g., "Translation Context")

### Claude's Discretion
- Exact structlog configuration and log field naming
- OCR library choice (pytesseract vs PyMuPDF built-in)
- Specific backoff parameters and retry timing
- DB schema changes for progress fields (new columns vs JSON field)
- Genre classification prompt design
- Quality check thresholds for garbled text detection

### Deferred Ideas (OUT OF SCOPE)
None -- all discussed items are in scope for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WRK-01 | Worker handles OS signals (SIGTERM/SIGINT) for graceful shutdown | Python signal module flag pattern + BLPOP timeout for interruptibility |
| WRK-02 | Worker automatically reconnects to Redis after connection drops | redis-py built-in Retry + ExponentialBackoff classes |
| WRK-03 | Worker uses structured logging (structlog) instead of print | structlog v25.x with JSONRenderer for production, ConsoleRenderer for dev |
| WRK-04 | Worker propagates specific error reasons to document status in DB | LLM SDK typed exceptions + structured error codes in DB |
| WRK-05 | Worker reports segment-level translation progress to DB | New columns on documents table + per-chunk DB updates |
| WRK-06 | Worker classifies LLM exceptions and only retries transient errors | Custom tenacity retry predicate using LLM SDK exception hierarchies |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| structlog | 25.x | Structured JSON logging | De facto Python structured logging; JSON output matches gateway's zap pattern |
| tenacity | 9.x | Retry with backoff | Already a dependency; supports custom retry predicates for error classification |
| redis-py | 5.x+ | Redis client with retry | Already a dependency; has built-in Retry/ExponentialBackoff since v4.5+ |
| psycopg2 | 2.9.x | PostgreSQL client | Already a dependency; wrap with tenacity for reconnection |
| PyMuPDF (fitz) | 1.24.x | PDF extraction + built-in OCR | Already a dependency; has built-in OCR via Tesseract integration |
| pydantic | 2.x | Schema validation | Already a dependency; extend for genre-specific context schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytesseract | 0.3.x | OCR fallback (alternative) | Only if PyMuPDF built-in OCR is insufficient; requires Tesseract system package |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| structlog | python-json-logger | structlog has better ergonomics, bound loggers, processor pipeline |
| Manual reconnect | SQLAlchemy connection pool retry | Pipeline already uses SQLAlchemy; DBService uses raw psycopg2 -- consolidate later |
| PyMuPDF OCR | pytesseract | PyMuPDF OCR avoids extra system dependency; try it first |

**Installation (new dependencies only):**
```bash
pip install structlog
```
Note: All other libraries are already in requirements.txt. PyMuPDF includes OCR support when Tesseract is installed at the system level. For Docker, add `tesseract-ocr` to the Dockerfile apt-get install.

## Architecture Patterns

### Recommended Change Structure
```
apps/worker/
├── main.py              # Add signal handling, shutdown flag, structured main loop
├── config.py            # Unchanged
├── logging_config.py    # NEW: structlog configuration module
├── errors.py            # NEW: Custom exception hierarchy for error classification
├── services/
│   ├── queue.py         # Add redis-py Retry/ExponentialBackoff, re-queue method
│   └── db.py            # Add tenacity-based reconnect, progress update methods
└── pipeline/
    ├── pipeline.py      # Accept shutdown_event, propagate to translator; progress callbacks
    ├── context_agent.py # Genre detection + genre-specific extraction; rename World Bible
    ├── translator.py    # Smart retry with error classification; chunk boundary improvement
    ├── extractor.py     # OCR fallback + quality checks
    ├── llm_client.py    # Exception wrapping to normalize across providers
    └── models.py        # Add progress/error fields if using new columns
```

### Pattern 1: Flag-Based Graceful Shutdown
**What:** Signal handler sets a flag; main loop checks flag between jobs; pipeline checks between chunks.
**When to use:** Any long-running worker that needs clean shutdown.
**Example:**
```python
import signal
import threading

shutdown_requested = threading.Event()

def handle_signal(signum, frame):
    shutdown_requested.set()

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

# Main loop
while not shutdown_requested.is_set():
    task = queue.get_task("tasks:process_pdf", timeout=5)  # Short timeout for responsiveness
    if task:
        process_task(db, queue, task, shutdown_requested)

# In translator, between chunks:
if shutdown_requested.is_set():
    # Save progress, re-queue remaining work
    raise InterruptedError("Shutdown requested")
```

### Pattern 2: LLM Exception Normalization
**What:** Wrap provider-specific exceptions into a common hierarchy for consistent retry logic.
**When to use:** Any multi-provider LLM integration.
**Example:**
```python
# errors.py
class LLMError(Exception):
    """Base for all LLM errors."""
    def __init__(self, message, provider, original_error=None):
        super().__init__(message)
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

# In llm_client.py generate():
try:
    return self._call_openai(...)
except openai.AuthenticationError as e:
    raise LLMAuthError("Invalid API key", "openai", e)
except openai.RateLimitError as e:
    raise LLMRateLimitError("Rate limit hit", "openai", e)
except openai.BadRequestError as e:
    if "content_policy" in str(e).lower() or "safety" in str(e).lower():
        raise LLMContentPolicyError("Content blocked", "openai", e)
    raise LLMTransientError(str(e), "openai", e)
except (openai.APIConnectionError, openai.InternalServerError) as e:
    raise LLMTransientError(str(e), "openai", e)
```

### Pattern 3: Redis Built-in Retry
**What:** Use redis-py's native Retry class instead of hand-rolling reconnect logic.
**When to use:** Any redis-py connection that needs resilience.
**Example:**
```python
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
from redis.exceptions import ConnectionError, TimeoutError
import redis

retry = Retry(ExponentialBackoff(cap=60, base=1), retries=25)
client = redis.Redis(
    host=host, port=port, db=0,
    retry=retry,
    retry_on_error=[ConnectionError, TimeoutError],
    socket_timeout=10,
    socket_connect_timeout=5,
    health_check_interval=30,
)
```

### Pattern 4: Progress Reporting via DB
**What:** Update document record with progress data after each chunk.
**When to use:** Long-running operations where frontend needs status visibility.
**Example:**
```python
# Recommendation: Add columns to documents table via migration
# translated_count INTEGER DEFAULT 0
# total_count INTEGER DEFAULT 0
# pipeline_phase TEXT  (extracting, generating_context, translating)
# error_detail JSONB  ({code: "...", message: "..."})

def update_progress(self, job_id, phase, translated_count=None, total_count=None):
    with self.conn.cursor() as cur:
        cur.execute("""
            UPDATE documents
            SET pipeline_phase = %s,
                translated_count = COALESCE(%s, translated_count),
                total_count = COALESCE(%s, total_count)
            WHERE id = %s
        """, (phase, translated_count, total_count, job_id))
```

### Anti-Patterns to Avoid
- **Retrying all exceptions equally:** The current `retry_if_exception_type(Exception)` in translator.py and context_agent.py retries auth errors, wasting time and logging noise. Use custom predicates.
- **Signal handler doing cleanup directly:** Signal handlers should only set flags. Complex cleanup (DB writes, re-queuing) happens in the main code path after the flag is detected.
- **Reconnecting inside exception handlers:** The current `db.py` calls `self.connect()` in the except block of `update_job_status`. This is fragile. Use tenacity retry decorator or the redis-py built-in retry pattern.
- **Two separate DB connection patterns:** pipeline.py uses SQLAlchemy; db.py uses raw psycopg2. Both need reconnection. Keep both for now (pipeline ORM operations vs. simple status updates), but ensure both have resilience.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis reconnection | Custom while/sleep loop | redis-py `Retry(ExponentialBackoff())` | Built-in, handles edge cases, jitter included |
| Retry with backoff | Custom retry loop | tenacity `@retry` with custom predicates | Already a dependency, handles all edge cases |
| Structured logging | Custom JSON formatter | structlog with JSONRenderer | Processor pipeline, bound loggers, stdlib integration |
| Exception classification | If/elif chains on status codes | Provider SDK exception types + custom hierarchy | SDKs already classify errors; wrap into unified types |
| OCR | External OCR service | PyMuPDF built-in `.get_text("text", ocr=True)` | Zero external dependency if Tesseract system package present |

**Key insight:** Every resilience concern in this phase has a mature library solution. The custom code should only be the thin glue between these solutions.

## Common Pitfalls

### Pitfall 1: BLPOP Blocks Signal Delivery
**What goes wrong:** Python signal handlers can only run between bytecode instructions. A blocking `BLPOP` with no timeout will prevent signal delivery indefinitely.
**Why it happens:** redis-py's BLPOP is a blocking C call that doesn't yield to Python's signal handler mechanism.
**How to avoid:** Always use `timeout` parameter on BLPOP (currently 5s, which is fine). The signal will be delivered when BLPOP returns None after timeout.
**Warning signs:** Worker doesn't respond to `docker stop` within the grace period (10s default).

### Pitfall 2: Google GenAI Exception Hierarchy
**What goes wrong:** The `google-genai` SDK uses `google.genai.errors.APIError` with a `code` attribute (HTTP status as int), not typed subclasses like openai/anthropic.
**Why it happens:** Different SDK design philosophy. No `AuthenticationError` subclass; you must check `error.code == 401`.
**How to avoid:** In the exception wrapper for Gemini, catch `google.genai.errors.APIError` and branch on `error.code` (401, 403, 429, 500+).
**Warning signs:** All Gemini errors treated as transient because only generic `Exception` is caught.

### Pitfall 3: SQLAlchemy Session vs psycopg2 Connection
**What goes wrong:** Adding reconnection to psycopg2 (DBService) but forgetting that SQLAlchemy sessions in pipeline.py also need connection resilience.
**Why it happens:** Two separate DB connection patterns exist in the codebase.
**How to avoid:** For SQLAlchemy, configure the engine with `pool_pre_ping=True` (validates connections before use) and `pool_recycle=3600`. For psycopg2 in DBService, use tenacity retry decorator on methods.
**Warning signs:** Pipeline fails on "connection already closed" while DBService reconnects fine.

### Pitfall 4: Re-queue Race Condition
**What goes wrong:** Worker re-queues a job on SIGTERM, but the same worker picks it up before shutting down.
**Why it happens:** Re-queue pushes to the same Redis queue that the main loop reads.
**How to avoid:** Set the shutdown flag BEFORE re-queuing. Main loop checks flag before calling `get_task`.
**Warning signs:** Job processed twice or stuck in infinite re-queue loop.

### Pitfall 5: Migration Coordination with Gateway
**What goes wrong:** Adding columns to `documents` table requires a golang-migrate migration in the gateway, not a SQLAlchemy migration.
**Why it happens:** Phase 1 established golang-migrate as sole schema owner; SQLAlchemy models are read-only mirrors.
**How to avoid:** Create migration `002_worker_progress.up.sql` in `apps/gateway/migrations/`. Update SQLAlchemy models in worker to match.
**Warning signs:** Worker SQLAlchemy model defines columns that don't exist in the actual DB.

### Pitfall 6: Content Policy Detection Varies by Provider
**What goes wrong:** Each LLM provider signals content policy violations differently.
**Why it happens:** OpenAI returns 400 with specific error codes. Anthropic may return 400 BadRequestError. Gemini returns specific `finish_reason` values like `SAFETY`.
**How to avoid:** Check both exception types AND response metadata (finish_reason for Gemini). For Gemini, a successful API call can still have blocked content via `finish_reason=SAFETY`.
**Warning signs:** Content policy blocks treated as transient errors, causing 5 retries of a permanently blocked chunk.

## Code Examples

### structlog Configuration
```python
# logging_config.py
import structlog
import logging
import sys

def configure_logging(dev_mode: bool = False):
    """Configure structlog for the worker.

    dev_mode=True: pretty console output for local development
    dev_mode=False: JSON output for Docker/production
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if dev_mode:
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(structlog.stdlib.ProcessorFormatter(
        processors=[*shared_processors, renderer],
    ))

    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

# Usage in any module:
import structlog
log = structlog.get_logger()

log.info("job.received", job_id=job_id, provider=llm_provider)
log.error("llm.auth_failed", job_id=job_id, provider="openai", error=str(e))
```

### tenacity Custom Retry Predicate for LLM Calls
```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Only retry transient errors
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type((LLMRateLimitError, LLMTransientError)),
    reraise=True,
)
def call_llm(self, chunk_data, world_bible, target_lang):
    # LLMAuthError and LLMContentPolicyError will NOT be retried
    ...
```

### DB Migration for Progress Fields
```sql
-- 002_worker_progress.up.sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pipeline_phase TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS translated_count INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_count INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_detail JSONB;
```

```sql
-- 002_worker_progress.down.sql
ALTER TABLE documents DROP COLUMN IF EXISTS pipeline_phase;
ALTER TABLE documents DROP COLUMN IF EXISTS translated_count;
ALTER TABLE documents DROP COLUMN IF EXISTS total_count;
ALTER TABLE documents DROP COLUMN IF EXISTS error_detail;
```

### LLM Exception Mapping (All Three Providers)
```python
# OpenAI exceptions:
import openai
# openai.AuthenticationError (401) -> LLMAuthError
# openai.PermissionDeniedError (403) -> LLMAuthError
# openai.RateLimitError (429) -> LLMRateLimitError
# openai.APIConnectionError -> LLMTransientError
# openai.InternalServerError (5xx) -> LLMTransientError
# openai.BadRequestError (400) -> check message for content_policy, else LLMTransientError

# Anthropic exceptions:
import anthropic
# anthropic.AuthenticationError (401) -> LLMAuthError
# anthropic.PermissionDeniedError (403) -> LLMAuthError
# anthropic.RateLimitError (429) -> LLMRateLimitError
# anthropic.APIConnectionError -> LLMTransientError
# anthropic.InternalServerError (5xx) -> LLMTransientError
# anthropic.BadRequestError (400) -> check for content policy

# Google GenAI exceptions:
from google.genai.errors import APIError
# APIError with code=401 -> LLMAuthError
# APIError with code=403 -> LLMAuthError
# APIError with code=429 -> LLMRateLimitError
# APIError with code>=500 -> LLMTransientError
# Successful response with finish_reason=SAFETY -> LLMContentPolicyError
# APIError with code=400 -> check message for safety/content, else LLMTransientError
```

### PyMuPDF OCR Fallback
```python
import fitz

doc = fitz.open(pdf_path)
page = doc[0]
blocks = page.get_text("blocks")

text_blocks = [b for b in blocks if b[6] == 0 and b[4].strip()]
if not text_blocks:
    # No text extracted - try OCR
    # PyMuPDF's get_text with OCR requires Tesseract installed
    try:
        ocr_text = page.get_text("text", ocr=True)
        if ocr_text.strip():
            # OCR succeeded - use OCR for all pages
            use_ocr = True
    except Exception:
        # OCR not available or failed
        raise ExtractionError("Could not extract text - PDF may be image-only or corrupted")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| redis-py manual reconnect | redis-py built-in Retry class | v4.5+ (2023) | No need for custom reconnect loops |
| print() debugging | structlog JSON logging | Long established | Machine-parseable logs, bound context |
| retry_if_exception_type(Exception) | Custom exception predicates | tenacity v6+ | Targeted retry prevents wasting time on fatal errors |
| PyMuPDF text-only | PyMuPDF OCR integration | fitz 1.19+ | Built-in OCR without separate library |

**Deprecated/outdated:**
- `google.generativeai` (old Gemini SDK): Project already uses `google.genai` (new SDK) -- correct choice
- redis-py `StrictRedis`: Merged into `Redis` class; `StrictRedis` is just an alias now

## Open Questions

1. **PyMuPDF OCR quality for non-Latin scripts**
   - What we know: PyMuPDF OCR delegates to Tesseract; Tesseract supports CJK but quality varies
   - What's unclear: Whether OCR quality is sufficient for Chinese/Japanese PDF translation
   - Recommendation: Implement OCR fallback as best-effort; log OCR quality metrics; user sees warning about potential quality issues

2. **Gemini content policy detection via finish_reason**
   - What we know: Gemini can return 200 OK but with `finish_reason=SAFETY` and empty/truncated content
   - What's unclear: Exact string values for all safety-related finish reasons across Gemini model versions
   - Recommendation: Check for `SAFETY`, `RECITATION`, and empty text content after successful API calls

3. **Genre classification accuracy**
   - What we know: LLM-based genre detection is generally reliable for clear-cut genres
   - What's unclear: How well it handles mixed-genre documents (e.g., technical document with narrative sections)
   - Recommendation: Use "general" as fallback; classification prompt should include "general" as a safe default

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (not yet installed -- Wave 0 gap) |
| Config file | None -- needs `pytest.ini` or `pyproject.toml` in `apps/worker/` |
| Quick run command | `cd apps/worker && python -m pytest tests/ -x --timeout=30` |
| Full suite command | `cd apps/worker && python -m pytest tests/ -v --timeout=60` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRK-01 | SIGTERM sets shutdown flag; main loop exits after current chunk | unit | `pytest tests/test_shutdown.py -x` | No -- Wave 0 |
| WRK-02 | QueueService reconnects after ConnectionError | unit | `pytest tests/test_queue.py -x` | No -- Wave 0 |
| WRK-03 | All log output is structured JSON (no print statements) | unit | `pytest tests/test_logging.py -x` | No -- Wave 0 |
| WRK-04 | Error reasons written to DB with structured codes | unit | `pytest tests/test_error_reporting.py -x` | No -- Wave 0 |
| WRK-05 | translated_count/total_count updated after each chunk | unit | `pytest tests/test_progress.py -x` | No -- Wave 0 |
| WRK-06 | Auth errors not retried; rate limits retried with backoff | unit | `pytest tests/test_error_classification.py -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/worker && python -m pytest tests/ -x --timeout=30`
- **Per wave merge:** `cd apps/worker && python -m pytest tests/ -v --timeout=60`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/worker/tests/` directory -- does not exist yet
- [ ] `apps/worker/tests/conftest.py` -- shared fixtures (mock DB, mock Redis, mock LLM client)
- [ ] `apps/worker/pyproject.toml` or `apps/worker/pytest.ini` -- pytest configuration
- [ ] Framework install: `pip install pytest pytest-timeout` + add to requirements.txt
- [ ] `apps/worker/tests/test_shutdown.py` -- covers WRK-01
- [ ] `apps/worker/tests/test_queue.py` -- covers WRK-02
- [ ] `apps/worker/tests/test_logging.py` -- covers WRK-03
- [ ] `apps/worker/tests/test_error_reporting.py` -- covers WRK-04
- [ ] `apps/worker/tests/test_progress.py` -- covers WRK-05
- [ ] `apps/worker/tests/test_error_classification.py` -- covers WRK-06

## Sources

### Primary (HIGH confidence)
- [structlog 25.5.0 official docs](https://www.structlog.org/en/stable/) -- configuration, JSONRenderer, stdlib integration
- [redis-py 7.3.0 official docs](https://redis.readthedocs.io/en/stable/retry.html) -- Retry class, ExponentialBackoff
- [tenacity official docs](https://tenacity.readthedocs.io/) -- retry_if_exception_type, custom predicates
- [OpenAI error codes](https://platform.openai.com/docs/guides/error-codes) -- exception hierarchy
- [Anthropic SDK README](https://github.com/anthropics/anthropic-sdk-python/blob/main/README.md) -- exception types
- [Google GenAI errors.py](https://github.com/googleapis/python-genai/blob/main/google/genai/errors.py) -- APIError class
- [Redis production usage](https://redis.io/docs/latest/develop/clients/redis-py/produsage/) -- reconnection best practices

### Secondary (MEDIUM confidence)
- [Redis FAQ: client reconnections](https://redis.io/faq/doc/22wxq63j93/how-to-manage-client-reconnections-in-case-of-errors-with-redis-py) -- verified against official docs
- Existing codebase analysis -- direct code reading of all worker files

### Tertiary (LOW confidence)
- PyMuPDF OCR integration specifics -- based on documentation references, not tested against actual scanned PDFs
- Gemini finish_reason SAFETY handling -- based on community reports, needs validation with actual blocked content

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use or well-documented, versions verified
- Architecture: HIGH -- patterns derived from official docs and existing codebase analysis
- Pitfalls: HIGH -- identified from code reading (two DB patterns, BLPOP blocking) and SDK docs
- Pipeline improvements: MEDIUM -- context agent genre detection and OCR are new capabilities without prior art in this codebase
- Validation: MEDIUM -- pytest is standard but no test infrastructure exists yet

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, mature libraries)

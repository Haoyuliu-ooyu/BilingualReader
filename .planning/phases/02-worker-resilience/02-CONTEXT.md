# Phase 2: Worker Resilience - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Worker handles failures gracefully: clean shutdown on SIGTERM, automatic reconnection after network drops, smart LLM error classification, granular translation progress, structured logging, and pipeline improvements for real-world document handling. Inter-service contracts (Redis queue format, DB schema) remain unchanged except for new status values and progress fields.

</domain>

<decisions>
## Implementation Decisions

### Graceful Shutdown
- On SIGTERM mid-translation: finish current chunk, save its translations, then re-queue remaining untranslated segments as a new job to Redis
- On SIGTERM while idle (BLPOP wait): exit immediately, interrupt the BLPOP
- New DB status `INTERRUPTED` distinguishes "killed mid-work" from "failed" — existing checkpoint logic in translator.py already skips translated segments on resume
- Signal handling via Python `signal` module in the main loop

### Error Classification
- Content policy violations (LLM refused to translate): skip the blocked chunk, mark those segments as `blocked`, continue translating the rest. User sees partial results with a note about blocked segments
- Transient errors (429 rate limit, timeout, 5xx): 5 retries with exponential backoff via tenacity. Fail after retries exhausted (~3 minutes)
- Fatal errors (401 auth, invalid API key): fail immediately, no retry
- Error reasons stored in DB as structured error codes + message (e.g., `{code: "LLM_AUTH_FAILED", message: "Invalid API key for OpenAI"}`) — frontend maps codes to display strings

### Progress Granularity
- Update DB after each chunk completes (every 20-40 segments) — balances visibility with DB write frequency
- Store as segment counts: `translated_count` and `total_count` (e.g., 45/120). Frontend calculates percentage
- Report all pipeline phases: `extracting` → `generating_context` → `translating`. Frontend can show phase-specific status messages
- New DB columns or JSON field on documents table for progress data

### Reconnection Strategy
- Redis: auto-reconnect with exponential backoff (1s, 2s, 4s... up to 60s max). Exit with non-zero code after exhausting retries (~5 minutes). Docker restart policy handles restart
- PostgreSQL: upgrade DBService to match Redis reconnect pattern — same backoff strategy, handle mid-query disconnects during progress updates
- Consistent reconnection behavior across both infrastructure dependencies

### Pipeline Optimization: Context Agent
- Two-call approach: first LLM call classifies document genre (fiction, technical, legal, academic, general) from a text sample. Second call uses genre-specific extraction with adapted schema
- Fiction: characters + traits + glossary + style guide (current approach, refined)
- Technical: terminology + abbreviations + domain context
- Legal: defined terms + parties + clause structure
- Academic: key concepts + citation style + field-specific terminology
- Explicit name→translation mapping table extracted in context step (e.g., "李明→Li Ming, NOT Lee Ming"). Injected into every chunk's translation prompt as a hard constraint. Catches aliases and informal name variants

### Pipeline Optimization: Chunk Boundaries
- Improve chunking to split at paragraph or section boundaries instead of purely by segment count/word count
- Better translation coherence — LLM sees complete thoughts rather than mid-paragraph splits

### Pipeline Optimization: Extraction
- OCR fallback: if PyMuPDF returns 0 text blocks, attempt OCR (pytesseract or PyMuPDF built-in OCR). If OCR also fails, return specific error: "Could not extract text — PDF may be image-only or corrupted"
- Basic quality check after extraction: detect garbled text (high ratio of non-printable chars, very short segments, encoding issues). Warn in status but continue — let user see what was extracted

### Structured Logging
- Replace all print() statements with structlog (JSON output)
- Match gateway's structured logging pattern (zap equivalent for Python)

### Claude's Discretion
- Exact structlog configuration and log field naming
- OCR library choice (pytesseract vs PyMuPDF built-in)
- Specific backoff parameters and retry timing
- DB schema changes for progress fields (new columns vs JSON field)
- Genre classification prompt design
- Quality check thresholds for garbled text detection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and in:

### Requirements
- `.planning/REQUIREMENTS.md` — WRK-01 through WRK-06 define the core resilience requirements

### Existing Code (must understand before modifying)
- `apps/worker/main.py` — Main loop, signal handling target, job processing
- `apps/worker/services/queue.py` — Redis BLPOP consumer, zero reconnect logic currently
- `apps/worker/services/db.py` — PostgreSQL connection with basic reconnect
- `apps/worker/pipeline/pipeline.py` — 3-phase pipeline orchestration
- `apps/worker/pipeline/context_agent.py` — World Bible generation (genre-blind, fiction-only schema)
- `apps/worker/pipeline/translator.py` — Chunk-based translation with tenacity retry (retries ALL exceptions)
- `apps/worker/pipeline/llm_client.py` — Multi-provider LLM abstraction (OpenAI, Gemini, Claude)
- `apps/worker/pipeline/extractor.py` — PyMuPDF text extraction (no OCR fallback, no quality check)

### Phase 1 Patterns (for consistency)
- `apps/gateway/` — Handler/service/repository layering and zap structured logging as reference pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tenacity` library: already a dependency, used in translator.py and context_agent.py — extend for reconnection and smarter retry
- `pydantic` models: used for LLM output validation — extend for genre-specific context schemas
- `LLMClient`: unified multi-provider interface — context agent genre detection uses this directly
- Checkpoint logic in `translator._get_untranslated()`: already supports resumable translation — INTERRUPTED status leverages this

### Established Patterns
- SQLAlchemy ORM for pipeline DB operations (pipeline.py creates its own session)
- psycopg2 for status updates in DBService (main.py uses this)
- Two separate DB connection patterns exist — may want to consolidate during this phase
- Redis via `redis-py` with BLPOP for job consumption

### Integration Points
- `documents.status` DB column: needs new values (INTERRUPTED) and progress fields
- Redis queue `tasks:process_pdf`: re-queue logic for interrupted jobs writes back here
- Docker Compose restart policy: worker exit code triggers container restart
- Frontend (Phase 3) will consume progress data and error codes added here

</code_context>

<specifics>
## Specific Ideas

- Name mistranslation is a real pain point — the name mapping table should be a first-class part of the context output, not buried in a glossary
- Scanned PDFs silently producing empty documents is a bad UX — OCR fallback should be attempted before giving up
- The "World Bible" concept is fiction-centric — renaming to something genre-neutral (e.g., "Document Context" or "Translation Context") would better reflect the auto-detect approach

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Pipeline improvements (context agent, extraction, chunking) fit under "worker resilience" as they address real-world failure modes.

</deferred>

---

*Phase: 02-worker-resilience*
*Context gathered: 2026-03-16*

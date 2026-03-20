---
status: awaiting_human_verify
trigger: "retry-unique-violation-and-frontend-error"
created: 2026-03-18T00:00:00Z
updated: 2026-03-18T00:00:00Z
---

## Current Focus

hypothesis: Two issues confirmed: (1) Gateway ResetForRetry only resets documents table but doesn't clean up project_metadata, pages, segments, or translations. Worker pipeline then crashes on INSERT with UniqueViolation. (2) The generic Exception handler in main.py passes raw error strings (including psycopg2 tracebacks) as the error message, which gets stored in DB and shown in frontend Details panel.
test: Fix both issues
expecting: Retry works cleanly; frontend shows sanitized errors
next_action: Implement fixes in gateway repo (clean up child rows on retry) and worker (use UPSERT for project_metadata), and sanitize error messages in main.py

## Symptoms

expected: Retrying a failed job should succeed. Frontend should show friendly error messages.
actual: Worker crashes with UniqueViolation on project_metadata INSERT. Raw SQL error shown in frontend.
errors: (psycopg2.errors.UniqueViolation) duplicate key value violates unique constraint "project_metadata_doc_id_key"
reproduction: Upload PDF, let translation fail, retry the same job.
started: Happens on retry of any failed job where context agent completed but translation failed.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-18T00:01:00Z
  checked: apps/gateway/repository/document.go ResetForRetry function (line 141-144)
  found: Only resets documents table fields (status, pipeline_phase, translated_count, total_count, error_detail). Does NOT delete project_metadata, pages, segments, or translations.
  implication: On retry, all child data from the previous attempt remains, causing unique constraint violations on re-insert.

- timestamp: 2026-03-18T00:02:00Z
  checked: apps/worker/pipeline/context_agent.py generate_translation_context (line 207-212)
  found: Uses plain db.add(metadata) + db.commit() — a straight INSERT with no conflict handling.
  implication: If project_metadata row already exists for this doc_id, UniqueViolation is thrown.

- timestamp: 2026-03-18T00:03:00Z
  checked: apps/worker/pipeline/extractor.py extract_and_save (line 87-94)
  found: Also does plain INSERT for pages and segments with no conflict handling.
  implication: Extractor would also fail on retry if pages already exist, but the unique constraint on project_metadata is hit first (context agent runs after extraction).

- timestamp: 2026-03-18T00:04:00Z
  checked: apps/worker/main.py process_task exception handler (line 144-148)
  found: Generic Exception handler does `error_msg = str(e)` and stores raw error string (up to 500 chars) as the error message.
  implication: Raw psycopg2/SQLAlchemy error strings get stored in DB and shown in frontend Details panel.

- timestamp: 2026-03-18T00:05:00Z
  checked: apps/web/src/components/DocumentCard.tsx (line 104-107)
  found: Details panel renders doc.error_detail.message directly in a <p> tag.
  implication: Whatever raw string is in the DB gets shown to users. The getErrorMessage function maps error codes to friendly messages (line 94), but the Details panel shows the raw message.

## Resolution

root_cause: Two-part issue: (1) Gateway's ResetForRetry doesn't clean up child rows (project_metadata, pages, segments, translations), so re-running the pipeline causes UniqueViolation on INSERT. (2) Raw exception strings from psycopg2/SQLAlchemy are stored as error messages and displayed in the frontend Details panel.
fix: (1) Add cleanup of child data in ResetForRetry (DELETE pages and project_metadata CASCADE before resetting document). (2) Use UPSERT in context_agent as defense-in-depth. (3) Sanitize error messages in worker's generic exception handler to not expose raw DB errors.
verification: Gateway builds successfully. All 19 worker tests pass. No gateway tests exist (no test files).
files_changed: [apps/gateway/repository/document.go, apps/worker/pipeline/context_agent.py, apps/worker/main.py]

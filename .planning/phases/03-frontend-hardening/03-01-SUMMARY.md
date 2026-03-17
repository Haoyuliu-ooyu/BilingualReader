---
phase: 03-frontend-hardening
plan: 01
subsystem: api
tags: [go, gin, postgresql, rest-api, retry]

requires:
  - phase: 01-gateway-foundation
    provides: "Repository pattern, DocumentMeta struct, route registration"
  - phase: 02-worker-resilience
    provides: "Worker progress columns (pipeline_phase, translated_count, total_count, error_detail)"
provides:
  - "Extended GET /api/documents response with progress fields"
  - "POST /api/documents/:id/retry endpoint for failed document re-queue"
  - "GetDocumentForRetry and ResetForRetry repository methods"
affects: [03-02, 03-03, 03-04, frontend-hardening]

tech-stack:
  added: []
  patterns: ["retry-with-ownership-verification", "status-gated-mutation"]

key-files:
  created: []
  modified:
    - apps/gateway/repository/interfaces.go
    - apps/gateway/repository/document.go
    - apps/gateway/services/document.go
    - apps/gateway/handlers/document.go
    - apps/gateway/router.go
    - apps/gateway/main.go

key-decisions:
  - "Retry reuses existing encrypted LLM key from user_llm_keys table rather than requiring re-submission"
  - "ResetForRetry clears pipeline_phase, error_detail, and resets counts to zero before re-queue"

patterns-established:
  - "Status-gated mutation: verify document.Status == FAILED before allowing retry"
  - "Error message-based HTTP status mapping in handlers for service-layer errors"

requirements-completed: [TUX-01, TUX-02, TUX-03]

duration: 2min
completed: 2026-03-17
---

# Phase 03 Plan 01: Gateway Progress & Retry API Summary

**Extended document list API with pipeline progress fields and added POST retry endpoint for failed documents**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T00:01:18Z
- **Completed:** 2026-03-17T00:03:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- DocumentMeta struct now includes pipeline_phase, translated_count, total_count, and error_detail fields
- ListByUser SQL query selects and scans all progress columns with proper null handling
- POST /api/documents/:id/retry endpoint validates ownership, checks FAILED status, resets state, and re-queues job

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DocumentMeta and ListByUser to include progress fields** - `57d31e1` (feat)
2. **Task 2: Add retry service method, handler, and route** - `afc9d4f` (feat)

## Files Created/Modified
- `apps/gateway/repository/interfaces.go` - Added progress fields to DocumentMeta, GetDocumentForRetry and ResetForRetry to interface
- `apps/gateway/repository/document.go` - Updated ListByUser query, added GetDocumentForRetry and ResetForRetry implementations
- `apps/gateway/services/document.go` - Added Retry method with ownership/status validation and job re-queue
- `apps/gateway/handlers/document.go` - Added RetryDocument handler with proper HTTP status codes
- `apps/gateway/router.go` - Registered POST /documents/:id/retry route
- `apps/gateway/main.go` - Updated NewDocumentService call with llmKeyRepo and queueService params

## Decisions Made
- Retry reuses the user's existing encrypted LLM key from the database rather than requiring the key to be re-submitted
- ResetForRetry clears all progress state (pipeline_phase, error_detail, counts) before re-queue to ensure clean restart

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend can now poll progress fields from GET /api/documents
- Frontend can trigger retry via POST /api/documents/:id/retry
- Ready for plans 03-02 through 03-04 (frontend UI work)

---
*Phase: 03-frontend-hardening*
*Completed: 2026-03-17*

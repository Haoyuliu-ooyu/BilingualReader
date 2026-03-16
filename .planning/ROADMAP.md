# Roadmap: BilingualReader

## Overview

BilingualReader is a working prototype that needs production hardening. This milestone transforms the app from a functional demo into a deployable, resilient product. The gateway gets restructured and secured, the worker gets graceful shutdown and smart error handling, the frontend gets proper progress feedback and error states, and the whole stack gets CI/CD and production deployment. Phases 1 and 2 are independent (gateway and worker internals don't overlap); Phase 3 depends on Phase 2 for granular status values; Phase 4 depends on all prior phases having testable structure.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Gateway Foundation** - Restructure gateway into layered architecture with security hardening and schema migrations
- [ ] **Phase 2: Worker Resilience** - Add graceful shutdown, structured logging, smart error handling, and granular progress tracking
- [ ] **Phase 3: Frontend Hardening** - Polish UI, add progress feedback, error states, retry capability, and React Query
- [ ] **Phase 4: CI/CD and Deployment** - Automated testing, GitHub Actions pipeline, production Docker config, and cloud VM deployment

## Phase Details

### Phase 1: Gateway Foundation
**Goal**: Gateway is a secure, well-structured service with layered architecture, versioned schema management, and production security controls
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, GW-01, GW-02, GW-03, GW-04, GW-05
**Success Criteria** (what must be TRUE):
  1. Gateway starts with golang-migrate running versioned migrations; inline DDL is gone and SQLAlchemy create_all is removed from worker
  2. CORS rejects requests from non-configured origins; rate limiting blocks rapid-fire login attempts
  3. Uploading an oversized PDF returns a clear file-size error; malformed inputs are rejected before reaching business logic
  4. Gateway code is organized into handler/service/repository layers; health check endpoint reports status of DB, Redis, and S3
  5. Deleting a document removes its S3 objects; structured logs (JSON via zap) replace all fmt/log Printf calls
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Core restructure: layered architecture, golang-migrate migrations, zap logging, worker SQLAlchemy removal
- [x] 01-02-PLAN.md — Security hardening: CORS restriction, rate limiting, file size enforcement, JWT validation, input sanitization
- [x] 01-03-PLAN.md — Health check endpoint and S3 cleanup on document deletion

### Phase 2: Worker Resilience
**Goal**: Worker handles failures gracefully -- shuts down cleanly on SIGTERM, reconnects after network drops, classifies LLM errors, and reports granular translation progress
**Depends on**: Nothing (independent of Phase 1; inter-service contracts unchanged)
**Requirements**: WRK-01, WRK-02, WRK-03, WRK-04, WRK-05, WRK-06
**Success Criteria** (what must be TRUE):
  1. Sending SIGTERM to the worker during a translation lets the current chunk finish, marks the job as resumable, and exits cleanly
  2. Worker automatically reconnects to Redis after a connection drop without manual intervention or restart
  3. LLM authentication errors (401) and content policy violations (400) fail immediately without retry; transient errors (rate limit, timeout) are retried with backoff
  4. Document status in the database shows granular progress (segment count or percentage) and specific error reasons (not just "FAILED")
  5. All worker output uses structured JSON logging (structlog) instead of print statements
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Frontend Hardening
**Goal**: Users see real-time translation progress, get actionable error messages, can retry failed translations, and experience a polished interface
**Depends on**: Phase 2 (needs granular status values and error details from worker)
**Requirements**: TUX-01, TUX-02, TUX-03, FE-01, FE-02, FE-03, FE-04, FE-05
**Success Criteria** (what must be TRUE):
  1. User sees translation progress updating during processing (segment count or percentage bar, not just a spinner)
  2. When a translation fails, the user sees a specific error reason and a retry button that resubmits without re-uploading
  3. Frontend layout is polished with proper spacing, alignment, and visual consistency across all pages
  4. Error boundaries catch component crashes and show informative recovery UI instead of a white screen
  5. Server state is managed via React Query with automatic polling, caching, and stale data handling
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: CI/CD and Deployment
**Goal**: The application is automatically tested, built, and deployable to a cloud VM with HTTPS and production-grade Docker configuration
**Depends on**: Phases 1, 2, 3 (needs testable structure from all prior phases)
**Requirements**: DEP-01, DEP-02, DEP-03
**Success Criteria** (what must be TRUE):
  1. Pushing to main triggers a GitHub Actions pipeline that builds, tests, and (on success) deploys each service with path-filtered triggers
  2. Production Docker Compose starts all services with health checks, restart policies, and no dev volume mounts
  3. Application is accessible over HTTPS via Caddy reverse proxy with automatic TLS certificate management
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
(Phases 1 and 2 are independent and could run in parallel, but sequential execution is cleaner for a solo workflow.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Gateway Foundation | 3/3 | Complete | 2026-03-16 |
| 2. Worker Resilience | 0/0 | Not started | - |
| 3. Frontend Hardening | 0/0 | Not started | - |
| 4. CI/CD and Deployment | 0/0 | Not started | - |

# Project Research Summary

**Project:** BilingualReader Hardening Milestone
**Domain:** Bilingual PDF translation microservices application (Go + Python + React)
**Researched:** 2026-03-15
**Confidence:** HIGH (findings grounded in direct codebase analysis, supplemented by established ecosystem patterns)

## Executive Summary

BilingualReader is a working prototype that needs production hardening rather than new features. The app correctly implements the core translation pipeline — PDF extraction, LLM-based context generation, chunk-based translation with checkpointing — and the three-service microservices architecture (Go gateway, Python worker, React frontend) is fundamentally sound. The path to production is not about adding capabilities but about shoring up the structural gaps that make the app fragile: no graceful shutdown, no schema migrations, blanket LLM retry logic, wildcard CORS, and zero tests.

The recommended approach is a four-phase hardening sequence that respects architectural dependencies. Phases 1 (gateway restructuring) and 2 (worker resilience) are independent and can be worked in parallel. Phase 3 (frontend polish) has a soft dependency on Phase 2 for granular status values. Phase 4 (CI/CD and deployment) requires all prior phases to have testable structure. The most critical investments are: replacing dual schema ownership (Go DDL + SQLAlchemy `create_all`) with golang-migrate as the single migration owner, adding SIGTERM-aware graceful shutdown to the worker, and classifying LLM exceptions before applying retry logic.

The primary risk is the refactoring introducing regressions with no test safety net. The gateway's API response shapes must be locked down with contract tests before any MVC restructuring begins, because the frontend depends on exact JSON field shapes. The secondary risk is the dual schema ownership pitfall: if `Base.metadata.create_all()` is not removed from the worker when migrations are introduced, silent schema drift will corrupt data over time.

## Key Findings

### Recommended Stack

The existing technology choices are correct and should not change. The additions needed are purely infrastructural: golang-migrate for schema versioning, uber-go/zap for structured logging in Go, structlog for structured logging in Python, @tanstack/react-query to replace manual polling logic, and vitest + React Testing Library for frontend tests. For deployment, Caddy is the right reverse proxy choice — automatic TLS with zero configuration. GitHub Actions CI with path filters is the correct CI/CD approach for this monorepo structure.

**Core technologies to add:**
- `golang-migrate/v4`: Schema migration ownership — replaces fragile inline DDL in `main.go`
- `uber-go/zap`: Structured logging for gateway — replaces `log.Printf` throughout
- `ulule/limiter/v3`: Rate limiting middleware for Gin — Redis-backed, works across restarts
- `structlog >=24.0`: Structured JSON logging for worker — replaces `print()` statements
- `pydantic >=2.5` (pin): LLM response validation — already present but unpinned and underutilized
- `tenacity >=8.2` (pin): Retry with proper exception classification — already present but misconfigured
- `@tanstack/react-query >=5.50`: Server state management — replaces manual fetch+polling boilerplate
- `sonner >=1.5`: Toast notifications — error feedback and progress confirmations
- `vitest >=2.0` + `@testing-library/react >=16.0`: Frontend testing — Vite-native
- `Caddy >=2.8`: Reverse proxy with automatic TLS — simpler than nginx for single-VM deployment
- `stretchr/testify v1`: Go testing assertions and mocks — project has zero tests currently

**What NOT to add:** shadcn/ui (competing component system), Kubernetes (over-engineered for scale), Axios (native fetch is sufficient), WebSockets for status (polling is appropriate for minute-long jobs).

### Expected Features

The app is being hardened for production, not feature-expanded. The "features" are production-readiness requirements that users implicitly expect.

**Must have (table stakes):**
- CORS restriction to actual domain — currently `AllowAllOrigins: true`, a security hole
- Rate limiting on auth and upload endpoints — prevents brute force and queue flooding
- File size limits at gateway — prevents DoS via large uploads
- JWT secret validation at startup — catch misconfiguration before accepting traffic
- Graceful worker shutdown — prevents documents stuck permanently in "PROCESSING"
- Redis reconnection in worker — prevents crash on transient network issues
- Database schema migrations — blocks all schema evolution without this
- Structured logging across all services — production debugging requires parseable logs
- Health checks with readiness conditions — prevents Docker boot races
- Error detail propagation — users need actionable error messages, not "FAILED"
- Retry failed translations — endpoint + UI button; DB model supports this already
- Granular progress feedback — EXTRACTING/CONTEXT_GEN/TRANSLATING status values in DB and UI
- API key validation endpoint — test keys before wasting user's time on upload
- Document deletion S3 cleanup — currently orphans S3 objects

**Should have (competitive):**
- LLM provider failover — automatic fallback if primary provider rate-limits
- Real-time progress via SSE — replace polling with server-sent events (long-term)

**Defer to future milestone:**
- Translation quality scoring — high complexity, research-heavy
- Segment-level translation editing — full feature, not a hardening item
- PDF export with layout preservation — full feature, complex PDF generation
- Multi-worker horizontal scaling — current bottleneck is LLM API latency, not compute

### Architecture Approach

The target architecture preserves all existing inter-service contracts (Redis queue format, PostgreSQL schema, REST API shape, JWT format) while restructuring the internals of each service independently. The gateway moves to a repository/service/handler layered pattern with constructor-based dependency injection. The worker gains signal handling, per-phase error isolation, and scoped SQLAlchemy sessions. The frontend gains a centralized API client, error boundaries, and React Query for server state.

**Major components:**
1. **Gateway Repository Layer** — Extract all raw SQL from handlers into typed repository structs; this is the prerequisite for unit testing
2. **Gateway Service Layer** — Business logic and orchestration separated from HTTP concerns; services depend on repository interfaces
3. **Gateway Handler Layer** — Reduced to request parsing, service delegation, and response formatting
4. **Gateway Middleware** — CORS (env-configured origins), rate limiting (Redis-backed), structured request logging
5. **Worker Consumer** — SIGTERM-aware shutdown loop with inter-chunk shutdown checks and stale job reaper
6. **Worker Pipeline** — Per-phase status tracking (EXTRACTING, CONTEXT_GEN, TRANSLATING) with isolated error handling per phase
7. **Worker LLM Client** — Exception classification for smart retry (retry RateLimitError/ConnectionError; fail-fast on AuthError/BadRequest)
8. **Frontend API Client** — Centralized fetch wrapper with error normalization and React Query integration
9. **SQL Migrations** — golang-migrate as single schema owner; SQLAlchemy models become read-only mappings

### Critical Pitfalls

1. **Dual schema ownership (Critical)** — Gateway DDL and SQLAlchemy `create_all()` compete silently. Pick golang-migrate as the single owner, remove `Base.metadata.create_all()` from worker, add startup validation in worker that schema matches models. Must be resolved before any other schema work.

2. **MVC refactor breaks API contract without tests (Critical)** — NULL handling in document queries (`sql.NullString`, `sql.NullTime`) changes JSON serialization when extracted to repositories. Write HTTP-level contract tests capturing exact request/response pairs for every endpoint BEFORE refactoring a single handler. Refactor one handler at a time.

3. **Blanket LLM retry causes runaway costs (Critical)** — `retry_if_exception_type(Exception)` retries auth errors (401) and content policy violations (400), burning user API quota. For a 200-page PDF with 3 retry passes: worst case 600 wasted calls. Classify exceptions; never retry `AuthenticationError`, `BadRequestError`, `PermissionDeniedError`.

4. **No graceful shutdown corrupts job state (Critical)** — SIGTERM kills worker mid-translation, leaving documents stuck in `PROCESSING` forever. Add signal handling that sets a shutdown flag checked between chunks (not just between jobs — a 200-page job can run 30+ minutes).

5. **Docker Compose boot races crash worker on deploy (Critical)** — `depends_on` without health checks lets the worker start before Postgres/Redis are ready. Worker has no retry on init (unlike gateway). Add `healthcheck` + `condition: service_healthy` to all infrastructure services. Worker calls `sys.exit(1)` on first connection failure — this must be fixed.

6. **Hardcoded secrets in compose defaults (Moderate)** — `JWT_SECRET` defaults to `dev-jwt-secret-change-me-in-production`. Use `${VAR:?error message}` syntax to make compose fail loudly if secrets are missing.

7. **Dev volume mounts in production (Moderate)** — `./apps/web:/app` mount overrides built container assets on the production VM. Use a separate `docker-compose.prod.yml` with all source mounts removed and multi-stage Dockerfile for the web service.

## Implications for Roadmap

Based on research, the dependency graph dictates this phase structure:

```
Phase 1 (Gateway Foundation) ----+
                                   +--> Phase 3 (Frontend Hardening) --> Phase 4 (CI/CD + Deploy)
Phase 2 (Worker Resilience) -----+
```

### Phase 1: Gateway Foundation

**Rationale:** Gateway restructuring is the most mechanical and lowest-risk change. It does not affect the worker or frontend because the REST API contract stays identical. However, it must happen before Phase 3 because Phase 3 tests depend on a testable gateway structure. The migration system must be the very first task because all subsequent schema changes depend on it.

**Delivers:** Layered, testable gateway with production security hardening and versioned schema management.

**Addresses:**
- Database schema migrations (golang-migrate replaces inline DDL)
- CORS restriction (env-configured origins, not wildcard)
- Rate limiting on auth and upload endpoints (Redis-backed via ulule/limiter)
- File size limits at gateway
- JWT secret validation at startup
- Document deletion S3 cleanup
- API key validation endpoint
- Structured logging (uber-go/zap)

**Avoids:**
- Dual schema ownership pitfall (golang-migrate becomes sole owner)
- MVC refactor breaks API contract (write contract tests first, refactor handler by handler)
- Hardcoded secrets in compose (replace `:-` defaults with `:?` for sensitive vars)

**Research flag:** STANDARD PATTERNS — Go repository/service/handler layering is well-documented. golang-migrate integration is straightforward. No additional research needed.

### Phase 2: Worker Resilience

**Rationale:** Fully independent from Phase 1 — worker changes are internal; Redis queue contract and DB schema remain unchanged. Can be worked in parallel with Phase 1. Must complete before Phase 3 because Phase 3 frontend progress feedback requires the granular status values (EXTRACTING, CONTEXT_GEN, TRANSLATING) that this phase introduces.

**Delivers:** Production-safe worker with graceful shutdown, structured logging, granular status tracking, and resilient LLM error handling.

**Addresses:**
- Graceful shutdown (SIGTERM handler with inter-chunk shutdown checks)
- Structured logging (structlog replacing print statements)
- Per-phase status tracking (EXTRACTING, CONTEXT_GEN, TRANSLATING, FAILED_*)
- LLM exception classification (retry only on transient errors)
- Redis reconnection on BLPOP failure
- SQLAlchemy session scoping (per-phase, not per-pipeline)
- Python dependency pinning (all packages get version bounds)
- Error detail propagation (store error reason and type in DB)

**Avoids:**
- Blanket retry runaway costs (exception classification prevents retrying 401/400 errors)
- No graceful shutdown corrupts job state (SIGTERM handler + stale job reaper)
- SQLAlchemy session leaks in long-running pipeline (per-phase session lifecycle)

**Research flag:** STANDARD PATTERNS — Python signal handling, structlog, tenacity exception classification are all well-documented. No additional research needed.

### Phase 3: Frontend Hardening

**Rationale:** Has a soft dependency on Phase 2 for the new granular status values. API client changes do not require gateway API changes (same endpoints, same responses). Cannot meaningfully show pipeline progress until Phase 2 introduces the status values.

**Delivers:** Production-quality frontend with proper error handling, progress feedback, and server state management.

**Addresses:**
- Granular progress feedback (EXTRACTING/CONTEXT_GEN/TRANSLATING status display)
- Meaningful error messages (display error type and reason from DB)
- Retry failed translations (UI button calling new gateway retry endpoint)
- API key validation UI (test key before upload)
- Centralized API client (replace scattered fetch calls)
- Error boundaries around major page sections
- Loading/error states with sonner toast notifications
- React Query for document status polling with exponential backoff
- Polling backoff to avoid amplification under load

**Avoids:**
- Frontend polling amplification (React Query with exponential backoff)
- Broken error states (error boundaries + centralized error normalization)

**Research flag:** STANDARD PATTERNS — React Query, error boundaries, toast notifications are well-documented patterns. No additional research needed.

### Phase 4: CI/CD and Production Deployment

**Rationale:** Tests are most valuable after restructuring because the layered architecture makes units independently testable. CI/CD requires tests to be meaningful. Deployment configuration ties everything together. Must come last.

**Delivers:** Automated testing pipeline, production Docker configuration, and cloud VM deployment.

**Addresses:**
- Go unit tests (repository and service layer tests)
- Python unit tests (pipeline stage tests, LLM client tests)
- Frontend component tests (Vitest + React Testing Library)
- GitHub Actions CI with per-service path filters
- Docker Compose health checks (Postgres, Redis, MinIO with `condition: service_healthy`)
- `docker-compose.prod.yml` (no source volume mounts, restart policies, resource limits)
- Caddy reverse proxy with automatic TLS
- Multi-stage Dockerfile for web service (built assets, not dev server)
- Deploy workflow (Docker build + push + VM SSH deploy)
- Integration smoke test in CI (upload small PDF, wait for translation, verify retrieval)

**Avoids:**
- Docker boot races (health checks with `condition: service_healthy`)
- Dev volume mounts in production (separate prod compose file)
- CI testing services in isolation (docker-compose integration test is higher priority than unit tests alone)

**Research flag:** NEEDS RESEARCH — The integration test setup (booting all services in CI, test PDF selection, assertion approach) may need investigation. Caddy configuration for serving both API and static assets from the same domain needs verification of exact config syntax.

### Phase Ordering Rationale

- Phases 1 and 2 are independent because the inter-service contracts (Redis job format, DB schema, REST API) are preserved throughout. This enables parallel work.
- Phase 3 depends on Phase 2 for the new status enum values that power progress feedback. Without EXTRACTING/CONTEXT_GEN/TRANSLATING, the frontend can only show a generic spinner.
- Phase 4 depends on all prior phases having testable structure. Tests written against messy handler-SQL-soup would be brittle; tests against repository/service/handler layers are clean and maintainable.
- The migration system (Phase 1, Task 1) must be the absolute first task. Every subsequent schema change in any phase depends on migrations being the single source of truth.
- API contract tests (Phase 1, Task 2) must precede MVC restructuring (Phase 1, Tasks 3-5). This is a strict sequential constraint within Phase 1.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Integration testing in CI):** Orchestrating a full docker-compose stack in GitHub Actions, including MinIO bucket initialization, test PDF selection, and timing for async translation jobs requires careful design. Recommend a `/gsd:research-phase` call before writing Phase 4 tasks.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Gateway Foundation):** Go repository/service/handler layering, golang-migrate, Gin middleware — all well-documented with abundant examples.
- **Phase 2 (Worker Resilience):** Python signal handling, structlog, tenacity exception typing — all standard library/well-established packages.
- **Phase 3 (Frontend Hardening):** React Query, Vitest, error boundaries, toast notifications — all well-documented with official guides.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Technology choices are well-established; specific version numbers are training-data based and should be verified against package registries before installation. Core recommendations (golang-migrate, zap, structlog, React Query, Caddy) are HIGH confidence individually. |
| Features | HIGH | Grounded in direct codebase analysis of BilingualReader and established production deployment checklists (12-factor, OWASP). Anti-features are clear. Priority ordering is opinionated but well-reasoned. |
| Architecture | HIGH | Patterns (repository/service/handler, constructor DI, graceful shutdown, per-phase pipeline) are standard Go and Python community conventions with extensive precedent. Anti-patterns are specific and well-reasoned. |
| Pitfalls | HIGH | All pitfalls derived from observed code patterns in THIS codebase (not generic advice). Dual schema ownership, API contract regression, LLM retry costs, graceful shutdown — all directly observable in the current code. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact version numbers:** All version recommendations should be verified against official package registries (pkg.go.dev, PyPI, npm) before installation. The training data cutoff means some versions may be outdated.
- **Caddy configuration for SPA routing:** Single-page app routing (all routes returning `index.html`) combined with API proxying requires specific Caddy config. Verify exact Caddyfile syntax during Phase 4 planning.
- **Integration test timing:** Async translation jobs take minutes. The CI integration smoke test needs either a mock LLM or a very small test PDF with a fast model. This design decision needs resolution in Phase 4 planning.
- **Stale job reaper implementation:** The worker needs a mechanism to detect and requeue jobs stuck in PROCESSING beyond a timeout. Whether this runs in the worker itself, a separate cron, or a gateway endpoint is a design choice to make during Phase 2 planning.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `apps/gateway/main.go`, `apps/gateway/handlers/document.go`, `apps/gateway/handlers/upload.go`, `apps/gateway/services/database.go`
- Direct codebase analysis: `apps/worker/main.py`, `apps/worker/pipeline/pipeline.py`, `apps/worker/pipeline/translator.py`, `apps/worker/pipeline/models.py`
- Direct codebase analysis: `docker-compose.yml`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`
- `.planning/PROJECT.md` — project requirements and constraints

### Secondary (MEDIUM confidence)
- Go community conventions: repository/service/handler layering, constructor-based DI — established patterns in production Go APIs
- Python standard library: signal handling, threading.Event for graceful shutdown — stdlib, no uncertainty
- GitHub Actions documentation: path filters for monorepo CI — native platform feature
- OWASP security guidelines: rate limiting, CORS, file size limits — established security standards
- 12-factor app methodology: environment-based configuration, structured logging — well-established

### Tertiary (LOW confidence — verify versions)
- golang-migrate v4: version verified against established Go ecosystem knowledge; confirm latest at pkg.go.dev
- ulule/limiter v3: MEDIUM confidence; verify v3 is current major version
- structlog >=24.0: verify latest minor at pypi.org
- @tanstack/react-query >=5.50: v5 is stable; verify latest minor at npmjs.com
- sonner >=1.5: actively maintained; verify latest at npmjs.com
- vitest >=2.0: Vite-native; verify latest at npmjs.com
- Caddy >=2.8: stable, well-known; verify at caddyserver.com

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*

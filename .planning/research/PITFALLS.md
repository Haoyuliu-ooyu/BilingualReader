# Domain Pitfalls

**Domain:** Bilingual PDF translation microservices app (Go + Python + React)
**Researched:** 2026-03-15
**Focus:** Production hardening of a working prototype

## Critical Pitfalls

Mistakes that cause data loss, rewrites, or production outages.

### Pitfall 1: Dual Schema Ownership Creates Migration Hell

**What goes wrong:** The gateway defines tables with raw SQL `CREATE TABLE IF NOT EXISTS` in `main.go`, while the worker defines the *same* tables via SQLAlchemy ORM models (`pipeline/models.py`) with `Base.metadata.create_all()`. When you introduce a proper migration system (e.g., golang-migrate or Alembic), you must reconcile these two competing schema definitions. If you pick one side (say Go migrations) but forget to update SQLAlchemy models, the worker's `create_all()` silently creates columns with wrong types or missing constraints. If you pick Alembic, the gateway's inline SQL still runs on startup and conflicts.

**Why it happens:** Prototype convenience -- each service manages its own schema independently, and `CREATE TABLE IF NOT EXISTS` masks the conflict until a column is added in one place but not the other.

**Consequences:**
- Adding a column via migration but not updating the SQLAlchemy model causes runtime errors when the ORM tries to map rows.
- The gateway's `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements (`main.go:72-73`) silently succeed even when they shouldn't exist anymore, masking migration failures.
- Deploying a migration that renames/drops a column while the old worker is still running causes immediate crash with no rollback path.

**Prevention:**
- Pick ONE migration owner. Use golang-migrate in the gateway since it controls the schema DDL. Remove `Base.metadata.create_all()` from `pipeline.py:init_db()`. SQLAlchemy models become read-only mappings, not schema creators.
- Delete all inline SQL from `main.go` once migrations are in place. No `CREATE TABLE IF NOT EXISTS` anywhere.
- Add a startup check in the worker that validates SQLAlchemy model columns match the actual database schema before processing jobs.

**Detection:** Worker logs showing `ProgrammingError: column "X" does not exist` after a gateway deployment. Or worse: silent column type mismatches (e.g., `String` vs `Text`) that corrupt data.

**Phase:** Database migration system setup -- must be addressed before any schema changes.

---

### Pitfall 2: MVC Refactor Breaks the Working API Contract

**What goes wrong:** When restructuring the gateway from its current "handlers directly call `DBService.Pool`" pattern into proper MVC layers (repository/service/handler), teams introduce regressions by changing response shapes, error codes, or query behavior. The current handlers contain raw SQL with specific `NULL` handling (`sql.NullString`, `sql.NullTime` in `document.go`), and extracting these into repository methods often changes how nulls are serialized in JSON.

**Why it happens:** MVC refactoring is treated as a pure code organization exercise. Without tests, there is no way to verify that the API contract (response shapes, status codes, error messages) remains identical. The frontend Zustand stores and API calls depend on exact response shapes.

**Consequences:**
- Frontend breaks silently (e.g., a field that was `""` becomes `null`, or `omitempty` is accidentally removed).
- The manual cascade delete in `DeleteDocument` (`document.go:215-251`) is particularly fragile -- extracting it into a repository method without preserving the exact transaction boundaries can leave orphan records.
- Error responses change format, breaking frontend error handling.

**Prevention:**
- Write API contract tests (HTTP-level) BEFORE refactoring. Capture exact request/response pairs for every endpoint, including error cases.
- Refactor one handler at a time, not all at once. Deploy and verify each one.
- Keep the manual cascade delete logic in a single transactional method. Do not split it across multiple repository calls without explicit transaction passing.
- Add a `test/api_contract_test.go` that pins response shapes using golden files or snapshot testing.

**Detection:** Frontend showing blank fields, broken document lists, or "undefined" values after a gateway deploy.

**Phase:** Must write API contract tests BEFORE the MVC refactoring phase. Testing and restructuring are sequential, not parallel.

---

### Pitfall 3: LLM Retry Logic Causes Runaway Costs and Timeouts

**What goes wrong:** The translation agent uses `tenacity` with `retry_if_exception_type(Exception)` and `stop_after_attempt(4)`. This retries on ALL exceptions, including rate limit errors (429), invalid API key errors (401), and content policy violations (400). For a 200-page PDF with 50 chunks, a persistent rate limit means 4 retries x 50 chunks = 200 wasted API calls before the job finally fails. With the multi-pass system (3 passes with shrinking chunks), the worst case is 4 retries x 50 chunks x 3 passes = 600 API calls.

**Why it happens:** Using a blanket `Exception` retry is the quick prototype approach. LLM APIs return many error types that should NOT be retried (auth errors, content policy, malformed requests).

**Consequences:**
- Users get billed for hundreds of failed API calls before seeing an error.
- Rate limit retries without respecting `Retry-After` headers make the rate limiting worse.
- The worker blocks on a single failing job for minutes (exponential backoff x 4 attempts x 50 chunks), preventing other jobs from processing.

**Prevention:**
- Classify exceptions: retry on `RateLimitError` (with `Retry-After` header respect), `APIConnectionError`, `InternalServerError`. Do NOT retry on `AuthenticationError`, `BadRequestError`, `PermissionDeniedError`.
- Add a per-job cost/call budget. After N total LLM calls for a single job, fail fast regardless of retry status.
- Add a per-chunk timeout (not just per-call). If a single chunk takes more than 60 seconds across all retries, skip it and move to the next chunk.
- Surface the specific error type to the user (rate limit vs auth vs content policy) so they can fix their API key or quota.

**Detection:** Worker logs showing repeated "Chunk failed after retries" for the same job. Users reporting unexpectedly high API bills.

**Phase:** LLM pipeline reliability phase -- before deploying to production users.

---

### Pitfall 4: No Graceful Shutdown Causes Data Corruption

**What goes wrong:** The worker's `main.py` has a bare `while True` loop with no signal handling. When Docker sends `SIGTERM` during deployment or scaling, the worker is killed mid-translation. The current code sets status to `PROCESSING` at the start but only sets `COMPLETED` or `FAILED` at the end. A killed worker leaves the job permanently stuck in `PROCESSING` with no recovery mechanism.

**Why it happens:** BLPOP-based workers need explicit signal handling that is easy to skip in prototyping.

**Consequences:**
- Documents stuck in "PROCESSING" forever after a deploy. Users see a perpetual spinner.
- If killed during `_save_translations`, partial translations are committed but the job is neither `COMPLETED` nor `FAILED`. The checkpoint system then considers those segments "done" but the job status is wrong.
- With the current `pipeline.py` approach (single SQLAlchemy session for the entire pipeline), a mid-pipeline kill can leave the session in an inconsistent state that leaks connections.

**Prevention:**
- Add `signal.signal(SIGTERM, handler)` and `signal.signal(SIGINT, handler)` in `main.py` that sets a `shutdown_requested` flag.
- Check the flag between chunks in `process_document`, not just between jobs. A 200-page PDF can take 30+ minutes -- checking only between jobs is insufficient.
- Add a "stale job detector" that finds jobs stuck in `PROCESSING` for longer than a configurable timeout and requeues them.
- Set Docker's `stop_grace_period` to allow the current chunk to finish (e.g., 30 seconds).

**Detection:** After any deploy, check for documents stuck in `PROCESSING` status. `SELECT * FROM documents WHERE status = 'PROCESSING' AND created_at < NOW() - INTERVAL '1 hour'`.

**Phase:** Worker reliability phase -- must be in place before production deployment.

---

### Pitfall 5: Docker Compose Production Deployment Without Health Checks Creates Boot Races

**What goes wrong:** The current `docker-compose.yml` uses `depends_on` without health checks. The gateway has a retry loop for Postgres (`main.go:27-36`), but the worker has no retry -- it calls `DBService(Config.DB_URL)` once and `sys.exit(1)` on failure. In production, services restart at different speeds after a VM reboot or deploy, causing the worker to crash-loop because Redis or Postgres is not ready yet.

**Why it happens:** `depends_on` only waits for the container to START, not for the service inside it to be READY. This works locally because startup is fast, but fails on slower VMs or when volumes need to initialize.

**Consequences:**
- Worker crash-loops on deploy, requiring manual restart.
- Gateway starts accepting requests before Postgres is fully ready, returning 500 errors for the first few seconds.
- MinIO may not have the bucket created yet, causing uploads to fail silently.

**Prevention:**
- Add `healthcheck` to Postgres, Redis, and MinIO services in `docker-compose.yml`. Use `depends_on: condition: service_healthy`.
- Add retry logic to the worker's service initialization (match what the gateway already does for DB).
- Add a startup probe or health endpoint to the worker that reports readiness.
- Use a `docker-compose.prod.yml` override file for production-specific settings (restart policies, resource limits, health checks).

**Detection:** Worker container in `Restarting` state after a `docker compose up`. Gateway health endpoint returning errors within the first 10 seconds of startup.

**Phase:** Deployment configuration phase.

## Moderate Pitfalls

### Pitfall 5: Hardcoded Secrets in Docker Compose Defaults

**What goes wrong:** The `docker-compose.yml` has default values for sensitive configuration: `JWT_SECRET` defaults to `dev-jwt-secret-change-me-in-production`, `LLM_KEY_ENCRYPTION_SECRET` has a hardcoded hex string, and MinIO credentials are `minioadmin/minioadmin`. If the production `.env` file is missing or incomplete, Docker Compose silently falls back to these defaults.

**Prevention:**
- Remove ALL default values for secrets from `docker-compose.yml`. Use `${VAR:?error message}` syntax to make Docker Compose fail loudly if a variable is missing.
- Add a pre-deploy script that validates all required environment variables are set and meet minimum requirements (JWT secret length, encryption key entropy).
- Never use `:-` (default value) syntax for secrets, only for non-sensitive config like ports.

**Detection:** Check deployed containers with `docker exec prism-gateway env | grep JWT_SECRET` -- if it shows the dev default, the production secret was not set.

**Phase:** Security hardening / deployment config phase.

---

### Pitfall 6: Adding Rate Limiting Without Considering the Worker Queue

**What goes wrong:** Teams add rate limiting to the gateway's auth endpoints (login/register) but forget about the upload endpoint. A malicious user can flood the upload endpoint, filling the Redis queue with jobs that the single-threaded worker processes sequentially. Since there is no file size limit enforcement, a single user can upload many large PDFs, blocking all other users' translations for hours.

**Prevention:**
- Rate limit uploads per-user (e.g., 5 concurrent processing jobs max).
- Add a maximum PDF file size at the gateway level (before S3 upload).
- Add queue depth monitoring. If the queue exceeds a threshold, reject new uploads with a 429.
- Consider per-user queue fairness: round-robin between users rather than pure FIFO.

**Detection:** Redis queue depth growing unboundedly. `LLEN tasks:process_pdf` returning values > 20 for a single-user system.

**Phase:** Security hardening phase, alongside auth rate limiting.

---

### Pitfall 7: SQLAlchemy Session Leaks in Long-Running Pipeline

**What goes wrong:** The pipeline creates one SQLAlchemy session in `pipeline.py:init_db()` and passes it through the entire pipeline (extraction, context agent, translation agent). For large PDFs, this session stays open for 30+ minutes. PostgreSQL connection timeouts, network hiccups, or Postgres restarts during this time crash the pipeline with no recovery.

**Prevention:**
- Use scoped sessions with explicit lifecycle management. Create sessions per-phase, not per-pipeline.
- Add connection health checks before each phase starts.
- Configure SQLAlchemy's `pool_pre_ping=True` to detect stale connections.
- Set `pool_recycle` to a value lower than PostgreSQL's `idle_in_transaction_session_timeout`.

**Detection:** Worker logs showing `OperationalError: server closed the connection unexpectedly` during long translation jobs. PostgreSQL logs showing `FATAL: terminating connection due to idle-in-transaction timeout`.

**Phase:** Worker reliability phase.

---

### Pitfall 8: CI/CD Pipeline That Tests Services in Isolation

**What goes wrong:** Teams set up CI with separate jobs for Go lint/test, Python lint/test, and React lint/test, but never test the services together. The most common bugs in this architecture are at the boundaries: JSON serialization mismatches between Go and Python, database schema drift between what the gateway creates and what the worker expects, Redis message format changes.

**Prevention:**
- Include a docker-compose integration test in CI that boots all services and runs a smoke test (upload a small PDF, wait for translation, verify retrieval).
- Pin the schema: generate a SQL dump from the gateway's migrations and validate that SQLAlchemy models are compatible.
- Add a shared schema contract (e.g., JSON Schema for Redis messages) tested by both Go and Python.

**Detection:** Gateway deploys that change the Redis message format without updating the worker. Worker deploys that expect new database columns not yet created by gateway migrations.

**Phase:** CI/CD setup phase -- the integration test is more valuable than per-service unit tests.

---

### Pitfall 9: Frontend Polling Amplifies Under Load

**What goes wrong:** The React frontend polls `GET /api/documents/:id` on a fixed interval to check translation status. If the worker is slow or backlogged, users refresh the page or open multiple tabs, multiplying the polling load. With N users each polling every 2 seconds, the gateway handles N/2 database queries per second just for status checks.

**Prevention:**
- Add exponential backoff to polling (start at 2s, increase to 30s after 1 minute of "PROCESSING").
- Return `ETag` or `Last-Modified` headers so the browser can use conditional requests.
- Long term: switch to Server-Sent Events (SSE) for status updates. SSE is simpler than WebSocket for one-way status updates and works through proxies.
- Add a `Cache-Control` header to the document status endpoint during PROCESSING state.

**Detection:** Gateway access logs showing the same document ID being polled hundreds of times. Database connection pool exhaustion under moderate user load.

**Phase:** Frontend polish phase, but the exponential backoff is a quick win to add during the first phase.

## Minor Pitfalls

### Pitfall 10: CORS Tightening Breaks Legitimate Requests

**What goes wrong:** Switching from `AllowAllOrigins: true` to a specific domain list breaks the app if the production domain, staging domain, or `localhost` for local development are not all included. The current config also sets `AllowCredentials: false` because it must be false with wildcard origins. Switching to specific origins without also enabling `AllowCredentials: true` breaks cookie-based auth if it is ever added.

**Prevention:**
- Use environment-variable-driven CORS origins: `ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000`.
- Test CORS with actual browser requests from the frontend domain, not just curl.
- Include both the production domain and any staging/preview domains.

**Phase:** Security hardening, but test thoroughly.

---

### Pitfall 11: Alembic Autogenerate Misses PostgreSQL-Specific Types

**What goes wrong:** If Alembic is chosen for migrations (since the worker already uses SQLAlchemy), `alembic revision --autogenerate` does not correctly detect changes to `JSONB`, `UUID`, or custom PostgreSQL types. It may generate empty migrations or incorrect type comparisons.

**Prevention:**
- If using Go-based migrations (golang-migrate), this is not relevant. But if using Alembic, configure `compare_type=True` and add custom type comparators for JSONB and UUID.
- Always review autogenerated migrations before applying them. Never blindly apply.

**Phase:** Migration system setup.

---

### Pitfall 12: Docker Volume Mounts in Production Override Built Assets

**What goes wrong:** The current `docker-compose.yml` mounts the web app source code as a volume (`./apps/web:/app`), which is correct for development (hot reload) but disastrous in production. The production container's built assets get overridden by the host's source files, or worse, the host directory does not exist on the production VM, causing the container to start with an empty app directory.

**Prevention:**
- Use a separate `docker-compose.prod.yml` that removes all source volume mounts.
- The web service should use a multi-stage Dockerfile that builds static assets and serves them via nginx, not a dev server.
- Never use `volumes: ./src:/app` patterns in production compose files.

**Detection:** Production web container serving the Vite dev server instead of built assets. Or container crashing because `/app/node_modules` is empty.

**Phase:** Deployment configuration phase.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database migrations | Dual schema ownership (Go DDL + SQLAlchemy `create_all`) | Pick one owner, remove the other. Test migration up/down on a copy of production data. |
| Gateway MVC refactor | API contract breakage with no test safety net | Write contract tests FIRST, then refactor handler by handler. |
| LLM pipeline reliability | Blanket retry on all exceptions, runaway costs | Classify errors, add cost budgets, add per-job timeouts. |
| Worker hardening | No signal handling + stuck PROCESSING jobs | Add SIGTERM handler, inter-chunk shutdown checks, stale job reaper. |
| Security hardening | Rate limiting uploads but not queue depth, CORS origin misconfiguration | Rate limit at multiple layers, environment-driven CORS. |
| CI/CD setup | Testing services in isolation misses boundary bugs | Docker-compose integration test is higher priority than unit tests. |
| Production deployment | Dev volume mounts, missing health checks, default secrets | Separate prod compose file, `${VAR:?}` for secrets, health checks on all infra services. |
| Frontend improvements | Polling amplification under load | Exponential backoff as quick win, SSE as long-term solution. |

## Sources

- Direct codebase analysis of `apps/gateway/main.go`, `apps/worker/main.py`, `apps/worker/pipeline/*.py`, `docker-compose.yml`
- Known issues documented in `.planning/codebase/CONCERNS.md`
- Confidence: HIGH -- all pitfalls are derived from observed code patterns in this specific codebase, not generic advice

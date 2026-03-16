# Phase 1: Gateway Foundation - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the Go gateway into a layered architecture (handler/service/repository) with versioned schema migrations via golang-migrate, security hardening (CORS, rate limiting, input validation, JWT validation), structured logging (zap), health check endpoint, and S3 cleanup on document deletion. No new features — production hardening of the existing gateway.

</domain>

<decisions>
## Implementation Decisions

### Migration rollout
- Clean-slate migration: write the ideal schema from scratch as migration 001 (no baseline — existing data can be recreated)
- Gateway owns ALL tables (users, documents, user_llm_keys, pages, source_segments, translations, project_metadata) — single source of truth
- Remove SQLAlchemy `create_all` from worker in Phase 1 (not deferred to Phase 2)
- Migrations run automatically on gateway startup before accepting traffic
- Migration files managed via golang-migrate

### Rate limiting & file size
- In-memory rate limiter (no Redis dependency for rate limiting)
- 10 requests per minute per IP on login and register endpoints
- Rate limiting scoped to auth endpoints only (other routes behind JWT)
- Maximum PDF upload size: 50 MB, enforced at upload with clear error message

### Restructuring approach
- Full handler → service → repository layer separation
- Repository layer owns all SQL queries; services contain business logic only
- Dependency injection via interfaces (enables mocking in tests)
- Rewrite all handlers at once (codebase is small — 6 handler files)
- Router setup extracted into dedicated `router.go`; `main.go` only does initialization and wiring

### CORS configuration
- ALLOWED_ORIGINS env var with comma-separated origins (e.g., "http://localhost:3000,https://app.example.com")
- Gateway fails to start if ALLOWED_ORIGINS is not set (prevents accidental open CORS)

### S3 cleanup on delete
- Synchronous S3 object deletion in the delete handler
- If S3 delete fails, log a warning but still delete the DB record (orphaned S3 object is acceptable)

### Input sanitization
- Validate and reject invalid inputs with clear error messages (don't silently modify)
- Whitelist allowed characters for filenames
- Language codes validated against a fixed BCP-47 whitelist (en, zh, ja, ko, fr, de, es, etc.)
- Parameterized queries already handled via GORM

### Health check
- Detailed per-dependency health check: JSON response with status of DB, Redis, and S3
- Health endpoint is public (no auth required) — accessible to Docker health checks and load balancers

### Logging
- zap logger: JSON encoder in production, colored console encoder in development
- Switch mode based on GIN_MODE or env var
- Replace Gin's default logger with zap middleware for structured request logging (method, path, status, latency, IP)
- Replace all fmt/log Printf calls with zap throughout the codebase

### Claude's Discretion
- Exact migration file naming convention and directory structure
- zap log level defaults per environment
- Specific BCP-47 language code whitelist contents
- Error response shape standardization (if any)
- Filename validation regex specifics

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gateway architecture
- `.planning/codebase/STRUCTURE.md` — Current directory layout and file locations
- `.planning/codebase/CONVENTIONS.md` — Go patterns, response format, error handling strategy
- `.planning/codebase/CONCERNS.md` — Security issues, tech debt, and known bugs relevant to this phase

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-01 through SEC-05, GW-01 through GW-05 requirement definitions
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 checkpoints that must be TRUE)

### Project context
- `.planning/PROJECT.md` — Constraints (preserve Go/Python/React stack, Docker Compose deployment)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/gateway/handlers/middleware.go` — JWT auth middleware (AuthRequired) to preserve during restructuring
- `apps/gateway/services/crypto.go` — AES-256-GCM encryption for LLM keys (keep as-is)
- `apps/gateway/services/s3.go` — S3/MinIO storage service (wrap in repository interface)
- `apps/gateway/services/database.go` — DB connection pool (DBService with pgxpool) — becomes foundation for repository layer
- `apps/gateway/services/queue.go` — Redis queue service (wrap in interface)

### Established Patterns
- Gin framework for HTTP routing with `c.JSON(status, gin.H{...})` response pattern
- GORM not actually used — raw SQL via pgxpool (`dbService.Pool.Exec/Query`)
- Handler structs with service fields (e.g., `UploadHandler{Storage, DB, Queue}`)
- JWT via golang-jwt/jwt with HS256 signing

### Integration Points
- `main.go` — Central wiring point; will be split into main.go (init) + router.go (routes)
- Docker Compose health check — will point to new `/health` JSON endpoint
- Worker dependency — worker's SQLAlchemy create_all must be removed; worker reads same DB tables
- `.env.example` — needs ALLOWED_ORIGINS added

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-gateway-foundation*
*Context gathered: 2026-03-15*

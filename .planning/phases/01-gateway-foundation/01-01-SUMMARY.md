---
phase: 01-gateway-foundation
plan: 01
subsystem: api
tags: [go, gin, pgxpool, golang-migrate, zap, repository-pattern, dependency-injection]

# Dependency graph
requires: []
provides:
  - Handler/service/repository layered architecture with interface-based DI
  - golang-migrate embedded SQL migrations (001_initial_schema)
  - Zap structured logging with ginzap request middleware
  - Config loading with ALLOWED_ORIGINS validation
  - Repository interfaces (UserRepository, DocumentRepository, LLMKeyRepository, PageRepository)
  - DocumentService, UploadService, AuthService business logic layer
  - Router extracted to router.go with gin.New() + ginzap
affects: [01-gateway-foundation, 02-worker-pipeline]

# Tech tracking
tech-stack:
  added: [golang-migrate/v4, gin-contrib/zap, go.uber.org/zap]
  patterns: [handler-service-repository layers, interface-based DI, embedded SQL migrations, zap structured logging]

key-files:
  created:
    - apps/gateway/config/config.go
    - apps/gateway/migrations/embed.go
    - apps/gateway/migrations/001_initial_schema.up.sql
    - apps/gateway/migrations/001_initial_schema.down.sql
    - apps/gateway/repository/interfaces.go
    - apps/gateway/repository/db.go
    - apps/gateway/repository/user.go
    - apps/gateway/repository/document.go
    - apps/gateway/repository/llmkey.go
    - apps/gateway/repository/page.go
    - apps/gateway/services/document.go
    - apps/gateway/services/upload.go
    - apps/gateway/router.go
  modified:
    - apps/gateway/main.go
    - apps/gateway/services/auth.go
    - apps/gateway/handlers/auth.go
    - apps/gateway/handlers/document.go
    - apps/gateway/handlers/upload.go
    - apps/gateway/handlers/llmkeys.go
    - apps/gateway/handlers/models.go
    - apps/gateway/handlers/middleware.go
    - apps/worker/pipeline/pipeline.py

key-decisions:
  - "Deleted services/database.go entirely rather than keeping as thin wrapper -- repository/db.go fully replaces it"
  - "Removed unused Base import from worker pipeline.py alongside create_all removal"

patterns-established:
  - "Handler-Service-Repository: handlers parse HTTP, services contain business logic, repositories own all SQL"
  - "Interface-based DI: all service and repository dependencies injected as interfaces for testability"
  - "Embedded migrations: SQL files embedded in Go binary via //go:embed, run at startup before traffic"
  - "Zap logging: gin.New() + ginzap.Ginzap + ginzap.RecoveryWithZap replaces gin.Default()"
  - "Config validation: ALLOWED_ORIGINS required at startup, fail-closed for security"

requirements-completed: [GW-01, GW-02, GW-03]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 1 Plan 1: Gateway Architecture Restructuring Summary

**Layered handler/service/repository architecture with golang-migrate embedded migrations, zap structured logging, and extracted router using gin.New()**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T06:14:52Z
- **Completed:** 2026-03-16T06:20:09Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments
- Full handler/service/repository layer separation with interface-based dependency injection
- golang-migrate versioned migrations replacing inline DDL in main.go
- Zap structured logging replacing all fmt.Println/log.Printf calls
- Router extracted to router.go with gin.New() + ginzap middleware (no duplicate logging)
- SQLAlchemy create_all removed from worker (gateway owns schema exclusively)
- CORS configured from ALLOWED_ORIGINS env var (fail-closed, no more wildcard)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create foundation layer** - `743a889` (feat) - config, migrations, repository interfaces and implementations
2. **Task 2: Rewire handlers, services, router, main.go with zap** - `a4cbb9b` (feat) - full restructuring, router extraction, logging replacement, worker cleanup

## Files Created/Modified

### Created
- `apps/gateway/config/config.go` - Environment config loading with ALLOWED_ORIGINS validation
- `apps/gateway/migrations/embed.go` - Go embed directive for SQL migration files
- `apps/gateway/migrations/001_initial_schema.up.sql` - Full database schema (7 tables, 5 indexes)
- `apps/gateway/migrations/001_initial_schema.down.sql` - Reverse migration (drop all tables)
- `apps/gateway/repository/interfaces.go` - All repository interfaces + shared types (DocumentMeta, SavedKeyInfo, Page, Block)
- `apps/gateway/repository/db.go` - Connection pool creation (NewPool)
- `apps/gateway/repository/user.go` - UserRepository implementation
- `apps/gateway/repository/document.go` - DocumentRepository implementation
- `apps/gateway/repository/llmkey.go` - LLMKeyRepository implementation
- `apps/gateway/repository/page.go` - PageRepository implementation with pages/segments/translations join
- `apps/gateway/services/document.go` - DocumentService with S3 cleanup on delete
- `apps/gateway/services/upload.go` - UploadService with S3 upload + queue push
- `apps/gateway/router.go` - SetupRouter with gin.New(), ginzap, CORS, route registration

### Modified
- `apps/gateway/main.go` - Init-only entrypoint: config, logger, DB pool with retry, migrations, DI wiring
- `apps/gateway/services/auth.go` - AuthService interface with repository-based DI
- `apps/gateway/handlers/auth.go` - Depends on AuthService interface, zap logger
- `apps/gateway/handlers/document.go` - Depends on DocumentService interface, zap logger
- `apps/gateway/handlers/upload.go` - Depends on UploadService + LLMKeyRepository, zap logger
- `apps/gateway/handlers/llmkeys.go` - Depends on LLMKeyRepository, zap logger
- `apps/gateway/handlers/models.go` - Depends on LLMKeyRepository, zap logger
- `apps/gateway/handlers/middleware.go` - AuthRequired accepts AuthService parameter
- `apps/worker/pipeline/pipeline.py` - Removed Base.metadata.create_all and unused Base import

### Deleted
- `apps/gateway/services/database.go` - Replaced by repository/db.go

## Decisions Made
- Deleted services/database.go entirely rather than keeping as a thin wrapper, since repository/db.go and config/config.go fully replace its functionality
- Removed unused `Base` import from worker pipeline.py alongside the `create_all` removal for clean imports

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layered architecture is in place, ready for security hardening (Plan 02: rate limiting, input validation, JWT secret validation)
- Health check endpoint is a placeholder ("OK" string), to be upgraded in Plan 03
- All repository interfaces defined, ready for mock implementations in testing

---
*Phase: 01-gateway-foundation*
*Completed: 2026-03-16*

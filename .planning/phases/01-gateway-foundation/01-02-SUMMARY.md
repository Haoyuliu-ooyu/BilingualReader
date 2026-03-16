---
phase: 01-gateway-foundation
plan: 02
subsystem: api
tags: [cors, rate-limiting, jwt, input-validation, security, gin]

# Dependency graph
requires:
  - phase: 01-gateway-foundation/01
    provides: "Handler/service/repository architecture, router.go, config.go"
provides:
  - "Per-IP rate limiter middleware for auth endpoints (10 req/min)"
  - "JWT secret minimum length validation (32 chars) at startup"
  - "CORS restricted to ALLOWED_ORIGINS env var"
  - "50MB file size enforcement on uploads"
  - "Filename whitelist regex validation"
  - "BCP-47 language code whitelist (24 languages)"
  - "LLM provider validation (openai, gemini, claude)"
affects: [01-gateway-foundation, testing]

# Tech tracking
tech-stack:
  added: [golang.org/x/time/rate]
  patterns: [per-IP rate limiting with cleanup goroutine, input validation at handler layer]

key-files:
  created: []
  modified:
    - apps/gateway/handlers/middleware.go
    - apps/gateway/handlers/upload.go
    - apps/gateway/config/config.go
    - apps/gateway/router.go
    - .env.example

key-decisions:
  - "Rate limiter uses token bucket at rate.Every(6s) with burst 10 for 10 req/min per IP"
  - "Stale IP entries cleaned every 3 minutes, evicted after 5 minutes inactive"
  - "AllowCredentials set to true since CORS uses explicit origins (not wildcard)"
  - "Default target language ES validated against whitelist before processing"

patterns-established:
  - "Validation at handler layer: file size, filename regex, language code whitelist, provider whitelist"
  - "Rate limiting middleware applied to route groups, not individual routes"
  - "Startup validation in config.go for critical env vars (ALLOWED_ORIGINS, JWT_SECRET length)"

requirements-completed: [SEC-01, SEC-02, SEC-03, SEC-04, SEC-05]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 1 Plan 2: Security Hardening Summary

**Per-IP rate limiting on auth endpoints, CORS restriction to configured origins, 50MB upload enforcement, JWT secret validation, and input sanitization for filenames/language codes/providers**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T06:23:31Z
- **Completed:** 2026-03-16T06:29:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Rate limiter middleware protecting auth endpoints from brute force (10 req/min/IP with automatic cleanup)
- JWT secret validated at startup -- gateway refuses to start with secret shorter than 32 characters
- CORS locked down to ALLOWED_ORIGINS env var with AllowCredentials enabled for explicit origins
- Upload handler enforces 50MB file size limit with descriptive error messages
- Filename validation via regex whitelist, language code validation via BCP-47 set, LLM provider validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Rate limiter, JWT secret validation, CORS enforcement** - `24e84bd` (feat) + `dc0c90c` (feat - env template)
2. **Task 2: Input validation (file size, filename, language code, provider)** - `0c50600` (feat)

## Files Created/Modified
- `apps/gateway/handlers/middleware.go` - Added IPRateLimiter struct, NewIPRateLimiter, Allow, cleanup goroutine, RateLimitMiddleware
- `apps/gateway/config/config.go` - Added JWT_SECRET minimum 32-character validation at startup
- `apps/gateway/router.go` - Rate limiter applied to auth group, AllowCredentials set to true
- `apps/gateway/handlers/upload.go` - 50MB limit, filename regex, language code whitelist, LLM provider validation
- `.env.example` - Added ALLOWED_ORIGINS variable, updated JWT_SECRET comment
- `apps/gateway/go.mod` - Added golang.org/x/time/rate dependency

## Decisions Made
- Rate limiter uses token bucket (rate.Every(6s), burst 10) giving 10 requests per minute per IP
- Cleanup goroutine runs every 3 minutes, evicts IPs not seen for 5 minutes (prevents memory leak)
- AllowCredentials changed from false to true since we use explicit origins (required for cookie/auth header support)
- Default target language "ES" is validated against the whitelist like any other language code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All SEC-01 through SEC-05 security requirements met
- Gateway compiles and builds successfully with all security middleware integrated
- Ready for Plan 03 (health check, logging, or remaining gateway work)

---
*Phase: 01-gateway-foundation*
*Completed: 2026-03-16*

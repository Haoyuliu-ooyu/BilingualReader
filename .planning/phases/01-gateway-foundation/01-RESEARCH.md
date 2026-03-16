# Phase 1: Gateway Foundation - Research

**Researched:** 2026-03-15
**Domain:** Go web service architecture, database migrations, security hardening, structured logging
**Confidence:** HIGH

## Summary

Phase 1 restructures the existing Go gateway (1,242 lines across 12 files) into a layered handler/service/repository architecture, replaces inline DDL with golang-migrate versioned migrations, adds security hardening (CORS restriction, rate limiting, input validation, JWT secret validation), replaces all logging with zap, adds a detailed health check endpoint, and ensures S3 cleanup on document deletion.

The codebase is small enough to restructure in one pass. The existing code uses raw pgxpool SQL (not GORM despite CONVENTIONS.md claiming otherwise), Gin framework, and has no tests. The worker's SQLAlchemy `Base.metadata.create_all(engine)` in `apps/worker/pipeline/pipeline.py:18` must also be removed as part of the migration ownership transfer.

**Primary recommendation:** Use golang-migrate v4 with Go-embedded migration files for schema management, gin-contrib/zap for structured request logging, and a hand-rolled per-IP rate limiter using `golang.org/x/time/rate` (standard library approach, no external dependency needed for the simple 10 req/min requirement).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Clean-slate migration: write the ideal schema from scratch as migration 001 (no baseline -- existing data can be recreated)
- Gateway owns ALL tables (users, documents, user_llm_keys, pages, source_segments, translations, project_metadata) -- single source of truth
- Remove SQLAlchemy `create_all` from worker in Phase 1 (not deferred to Phase 2)
- Migrations run automatically on gateway startup before accepting traffic
- Migration files managed via golang-migrate
- In-memory rate limiter (no Redis dependency for rate limiting)
- 10 requests per minute per IP on login and register endpoints
- Rate limiting scoped to auth endpoints only (other routes behind JWT)
- Maximum PDF upload size: 50 MB, enforced at upload with clear error message
- Full handler -> service -> repository layer separation
- Repository layer owns all SQL queries; services contain business logic only
- Dependency injection via interfaces (enables mocking in tests)
- Rewrite all handlers at once (codebase is small -- 6 handler files)
- Router setup extracted into dedicated `router.go`; `main.go` only does initialization and wiring
- ALLOWED_ORIGINS env var with comma-separated origins (e.g., "http://localhost:3000,https://app.example.com")
- Gateway fails to start if ALLOWED_ORIGINS is not set (prevents accidental open CORS)
- Synchronous S3 object deletion in the delete handler
- If S3 delete fails, log a warning but still delete the DB record (orphaned S3 object is acceptable)
- Validate and reject invalid inputs with clear error messages (don't silently modify)
- Whitelist allowed characters for filenames
- Language codes validated against a fixed BCP-47 whitelist (en, zh, ja, ko, fr, de, es, etc.)
- Parameterized queries already handled via pgxpool
- Detailed per-dependency health check: JSON response with status of DB, Redis, and S3
- Health endpoint is public (no auth required)
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | CORS restricted to configured origins | gin-contrib/cors with ALLOWED_ORIGINS env var; fail startup if unset |
| SEC-02 | Rate limiting on login/register | golang.org/x/time/rate per-IP limiter; 10 req/min on auth group |
| SEC-03 | Max PDF file size at upload | Gin c.Request.FormFile + header.Size check against 50MB constant |
| SEC-04 | JWT secret validated for min length/entropy | Startup check in main.go; require min 32 chars |
| SEC-05 | Input sanitization (filenames, lang codes, user inputs) | Regex whitelist for filenames, BCP-47 set for lang codes |
| GW-01 | Handler/service/repository layered architecture with DI | Interface-based DI pattern; repository wraps pgxpool |
| GW-02 | Versioned migrations via golang-migrate | golang-migrate v4.19.1 with go:embed; migration 001 creates full schema |
| GW-03 | Structured logging via zap | go.uber.org/zap + gin-contrib/zap for request middleware |
| GW-04 | Health check reporting DB, Redis, S3 | Public GET /health endpoint; JSON with per-dependency status |
| GW-05 | Document deletion removes S3 objects | Already partially implemented; needs proper error handling with zap logging |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/golang-migrate/migrate/v4 | v4.19.1 | Database schema migrations | De facto Go migration tool; supports pgx, file/embed sources |
| go.uber.org/zap | latest | Structured logging | Industry standard; zero-allocation JSON encoder |
| github.com/gin-contrib/zap | v1.1.6+ | Gin request logging middleware | Official gin-contrib; replaces default logger |
| golang.org/x/time/rate | latest | Token bucket rate limiter | Standard library extension; no external dependency |
| github.com/gin-contrib/cors | v1.7.6 | CORS middleware | Already in use; needs configuration tightening |

### Supporting (already in go.mod)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| github.com/gin-gonic/gin | v1.11.0 | HTTP framework | Already used |
| github.com/jackc/pgx/v5 | v5.8.0 | PostgreSQL driver | Already used (pgxpool) |
| github.com/redis/go-redis/v9 | v9.17.3 | Redis client | Already used |
| github.com/aws/aws-sdk-go-v2 | v1.41.1 | S3/MinIO client | Already used |
| github.com/golang-jwt/jwt/v5 | v5.3.1 | JWT auth | Already used |

### New Dependencies Required
```bash
cd apps/gateway
go get github.com/golang-migrate/migrate/v4
go get github.com/golang-migrate/migrate/v4/database/pgx/v5
go get github.com/golang-migrate/migrate/v4/source/iofs
go get go.uber.org/zap
go get github.com/gin-contrib/zap
go get golang.org/x/time/rate
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| golang-migrate | goose | goose also popular but golang-migrate has better Go embed support and is more widely adopted |
| x/time/rate | ulule/limiter | External lib adds dependency for a simple 10 req/min use case; x/time/rate is sufficient |
| gin-contrib/zap | custom middleware | gin-contrib/zap is maintained, tested, and handles edge cases |

## Architecture Patterns

### Recommended Project Structure
```
apps/gateway/
├── main.go                    # Init only: create logger, DB, services, run migrations, start server
├── router.go                  # All route registration, middleware attachment
├── handlers/
│   ├── auth.go                # AuthHandler (register, login, me)
│   ├── document.go            # DocumentHandler (list, get, delete, get-pdf)
│   ├── upload.go              # UploadHandler (upload with validation)
│   ├── llmkeys.go             # LLMKeysHandler (save, list, delete keys)
│   ├── models.go              # ModelsHandler (list LLM models)
│   └── middleware.go          # AuthRequired middleware
├── services/
│   ├── auth.go                # JWT + bcrypt (GenerateToken, ValidateToken, Hash/CheckPassword)
│   ├── crypto.go              # AES-256-GCM encryption (keep as-is)
│   ├── document.go            # Document business logic (validation, S3 cleanup orchestration)
│   └── upload.go              # Upload business logic (file validation, metadata creation)
├── repository/
│   ├── interfaces.go          # All repository interfaces
│   ├── user.go                # UserRepository (CRUD for users table)
│   ├── document.go            # DocumentRepository (CRUD for documents + cascade delete)
│   ├── llmkey.go              # LLMKeyRepository (CRUD for user_llm_keys)
│   ├── page.go                # PageRepository (read pages + segments + translations)
│   ├── health.go              # HealthRepository (ping DB, Redis, S3)
│   └── db.go                  # DB connection pool setup
├── migrations/
│   ├── embed.go               # //go:embed directive for migration files
│   ├── 001_initial_schema.up.sql
│   └── 001_initial_schema.down.sql
├── models/
│   └── payload.go             # JobPayload struct (keep as-is)
├── config/
│   └── config.go              # Environment config loading, validation
├── go.mod
└── go.sum
```

### Pattern 1: Repository Interface with DI
**What:** Each repository is defined as an interface, implemented by a struct wrapping pgxpool.
**When to use:** All database access goes through repository interfaces.
**Example:**
```go
// repository/interfaces.go
type UserRepository interface {
    FindByEmail(ctx context.Context, email string) (*models.User, error)
    Create(ctx context.Context, user *models.User) error
    ExistsByEmail(ctx context.Context, email string) (bool, error)
}

type DocumentRepository interface {
    FindByIDAndUser(ctx context.Context, docID, userID string) (*models.Document, error)
    ListByUser(ctx context.Context, userID string) ([]models.Document, error)
    Create(ctx context.Context, doc *models.Document) error
    Delete(ctx context.Context, docID string) error  // CASCADE handled by DB
    GetS3Key(ctx context.Context, docID, userID string) (string, error)
}

// repository/user.go
type userRepo struct {
    pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) UserRepository {
    return &userRepo{pool: pool}
}

func (r *userRepo) FindByEmail(ctx context.Context, email string) (*models.User, error) {
    var u models.User
    err := r.pool.QueryRow(ctx,
        "SELECT id, email, password FROM users WHERE email = $1", email,
    ).Scan(&u.ID, &u.Email, &u.PasswordHash)
    if err != nil {
        return nil, err
    }
    return &u, nil
}
```

### Pattern 2: Handler Depends on Service, Service Depends on Repository
**What:** Clean dependency chain. Handlers parse HTTP, services contain business logic, repositories own SQL.
**When to use:** Every endpoint follows this pattern.
**Example:**
```go
// handlers/auth.go
type AuthHandler struct {
    authService services.AuthService
    logger      *zap.Logger
}

func NewAuthHandler(authSvc services.AuthService, logger *zap.Logger) *AuthHandler {
    return &AuthHandler{authService: authSvc, logger: logger}
}

func (h *AuthHandler) HandleLogin(c *gin.Context) {
    var req LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password are required."})
        return
    }
    token, user, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
    if err != nil {
        h.logger.Warn("login failed", zap.String("email", req.Email), zap.Error(err))
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password."})
        return
    }
    c.JSON(http.StatusOK, authResponse{Token: token, User: userInfo{ID: user.ID, Email: user.Email}})
}
```

### Pattern 3: Embedded Migrations Run at Startup
**What:** Migration SQL files embedded in Go binary via `//go:embed`, run before server accepts traffic.
**When to use:** Every gateway startup.
**Example:**
```go
// migrations/embed.go
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS

// main.go
import (
    "github.com/golang-migrate/migrate/v4"
    _ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
    "github.com/golang-migrate/migrate/v4/source/iofs"
    "gateway/migrations"
)

func runMigrations(dbURL string, logger *zap.Logger) error {
    source, err := iofs.New(migrations.FS, ".")
    if err != nil {
        return fmt.Errorf("creating migration source: %w", err)
    }
    m, err := migrate.NewWithSourceInstance("iofs", source, "pgx5://"+dbURL)
    if err != nil {
        return fmt.Errorf("creating migrator: %w", err)
    }
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return fmt.Errorf("running migrations: %w", err)
    }
    logger.Info("migrations applied successfully")
    return nil
}
```

### Pattern 4: Per-IP Rate Limiter with Cleanup
**What:** Map of IP -> rate.Limiter with periodic cleanup of stale entries.
**When to use:** Applied only to auth endpoints (/api/auth/login, /api/auth/register).
**Example:**
```go
// middleware/ratelimit.go
type IPRateLimiter struct {
    mu       sync.RWMutex
    limiters map[string]*visitorEntry
    rate     rate.Limit
    burst    int
}

type visitorEntry struct {
    limiter  *rate.Limiter
    lastSeen time.Time
}

func NewIPRateLimiter(r rate.Limit, burst int) *IPRateLimiter {
    rl := &IPRateLimiter{
        limiters: make(map[string]*visitorEntry),
        rate:     r,
        burst:    burst,
    }
    go rl.cleanup() // background goroutine to evict stale entries
    return rl
}

func (rl *IPRateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    v, exists := rl.limiters[ip]
    if !exists {
        v = &visitorEntry{
            limiter:  rate.NewLimiter(rl.rate, rl.burst),
            lastSeen: time.Now(),
        }
        rl.limiters[ip] = v
    }
    v.lastSeen = time.Now()
    rl.mu.Unlock()
    return v.limiter.Allow()
}

// RateLimitMiddleware returns a Gin middleware
func RateLimitMiddleware(rl *IPRateLimiter) gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        if !rl.Allow(ip) {
            c.AbortWithStatusJSON(http.StatusTooManyRequests,
                gin.H{"error": "Too many requests. Please try again later."})
            return
        }
        c.Next()
    }
}

// Usage: 10 requests per minute = rate.Every(6*time.Second), burst of 10
// authGroup.Use(RateLimitMiddleware(NewIPRateLimiter(rate.Every(6*time.Second), 10)))
```

### Pattern 5: Zap Logger Initialization
**What:** Create zap logger based on environment, use throughout app.
**Example:**
```go
func newLogger() (*zap.Logger, error) {
    mode := os.Getenv("GIN_MODE")
    if mode == "release" {
        cfg := zap.NewProductionConfig()
        cfg.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
        return cfg.Build()
    }
    cfg := zap.NewDevelopmentConfig()
    cfg.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
    return cfg.Build()
}
```

### Anti-Patterns to Avoid
- **SQL in handlers:** Never write SQL directly in handler functions. All SQL goes through repository layer.
- **Concrete service types in handlers:** Always inject interfaces, not concrete structs, to enable testing.
- **Silent error swallowing:** Current code has `if err == nil { for segRows.Next() { ... } }` patterns that silently ignore errors. Always log and handle.
- **Manual cascade deletes:** Current `DeleteDocument` does manual multi-table deletes. With proper `ON DELETE CASCADE` in migration, a single `DELETE FROM documents WHERE id = $1` cascades automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migrations | Custom SQL exec in main.go | golang-migrate v4 with embedded files | Version tracking, up/down, dirty state handling, team workflow |
| CORS middleware | Custom header setting | gin-contrib/cors | Preflight handling, credential rules, origin matching |
| Request logging | Custom gin.HandlerFunc with fmt.Printf | gin-contrib/zap (Ginzap + RecoveryWithZap) | Structured fields, panic recovery, latency tracking, skip paths |
| Token bucket algorithm | Custom counter + timer | golang.org/x/time/rate | Battle-tested, handles bursts correctly, thread-safe |
| JSON logging | Custom JSON marshaling | zap.NewProductionConfig() | Zero-allocation, leveled, caller info, stack traces |

**Key insight:** The gateway is small (1,242 lines total) but every piece of infrastructure (logging, migrations, rate limiting, CORS) has subtle edge cases. Using standard libraries prevents re-discovering those edge cases.

## Common Pitfalls

### Pitfall 1: golang-migrate pgx5 driver import path
**What goes wrong:** Using the wrong database driver string or import path.
**Why it happens:** golang-migrate has multiple postgres drivers: `postgres` (for database/sql) and `pgx5` (for pgx v5).
**How to avoid:** Use `_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"` import and `"pgx5://"` URL prefix. The existing codebase uses pgx v5 (pgxpool), so use the pgx5 driver.
**Warning signs:** "unknown driver" error at startup.

### Pitfall 2: Migration file naming
**What goes wrong:** golang-migrate requires specific file naming: `{version}_{title}.{direction}.sql`
**Why it happens:** Any deviation (wrong separator, missing direction) causes the file to be silently ignored.
**How to avoid:** Use format: `001_initial_schema.up.sql` and `001_initial_schema.down.sql`. Version must be a positive integer.
**Warning signs:** `ErrNoChange` when you expect migrations to run.

### Pitfall 3: Dirty database state
**What goes wrong:** If a migration fails partway, the DB is marked "dirty" and subsequent migrations refuse to run.
**Why it happens:** golang-migrate tracks version + dirty flag in a `schema_migrations` table.
**How to avoid:** Keep migrations small and idempotent where possible. In development, use `m.Force(version)` to reset. For production, wrap migration logic in transactions (golang-migrate does this automatically for PostgreSQL).
**Warning signs:** `ErrDirty` error on startup.

### Pitfall 4: gin.Default() vs gin.New()
**What goes wrong:** `gin.Default()` adds its own Logger and Recovery middleware, which conflict with zap replacements.
**Why it happens:** Developers forget that Default() includes middleware.
**How to avoid:** Use `gin.New()` and explicitly add `ginzap.Ginzap()` and `ginzap.RecoveryWithZap()`.
**Warning signs:** Duplicate log lines (once from gin's logger, once from zap).

### Pitfall 5: CORS middleware order
**What goes wrong:** CORS preflight (OPTIONS) requests get rejected by auth middleware.
**Why it happens:** CORS middleware must be registered before any auth middleware to handle preflight.
**How to avoid:** Register CORS middleware at the router level (before route groups), not inside protected groups.
**Warning signs:** Frontend gets CORS errors only on non-GET requests.

### Pitfall 6: Rate limiter memory leak
**What goes wrong:** IP entries accumulate indefinitely in the rate limiter map.
**Why it happens:** New IPs are added but never removed.
**How to avoid:** Run a background goroutine that periodically (e.g., every 3 minutes) evicts entries not seen for > 5 minutes.
**Warning signs:** Growing memory usage over time.

### Pitfall 7: S3 deletion and DB cascade ordering
**What goes wrong:** S3 object deleted but DB delete fails, leaving broken state.
**Why it happens:** S3 deletion is not transactional with DB.
**How to avoid:** Per user decision: delete S3 first, then DB. If S3 fails, log warning but proceed with DB deletion. Orphaned S3 objects are acceptable.
**Warning signs:** Document appears deleted but S3 objects remain (acceptable per decision).

### Pitfall 8: Worker SQLAlchemy removal
**What goes wrong:** Worker crashes on startup because tables don't exist yet (gateway hasn't run migrations).
**Why it happens:** Worker depended on `create_all` to bootstrap tables. After removal, it relies on gateway having run first.
**How to avoid:** docker-compose `depends_on` already ensures gateway starts first. Gateway runs migrations before accepting traffic. Worker should fail gracefully if tables don't exist and retry.
**Warning signs:** Worker fails with "relation does not exist" errors if started before gateway.

## Code Examples

### Migration 001: Full Schema
```sql
-- 001_initial_schema.up.sql
-- Source: derived from existing inline DDL in main.go + worker/pipeline/models.py

CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT,
    s3_key        TEXT,
    status        TEXT,
    target_lang   TEXT,
    result        JSONB,
    llm_provider  TEXT,
    llm_model     TEXT,
    created_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_llm_keys (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_hint      TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS project_metadata (
    meta_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id           TEXT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    world_bible_json JSONB
);

CREATE TABLE IF NOT EXISTS pages (
    page_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id      TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    width       DOUBLE PRECISION NOT NULL,
    height      DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS source_segments (
    seg_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id     UUID NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
    block_index INTEGER NOT NULL,
    original_text TEXT NOT NULL,
    bbox        JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS translations (
    trans_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seg_id          UUID NOT NULL REFERENCES source_segments(seg_id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    translated_text TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_doc_id ON pages(doc_id);
CREATE INDEX IF NOT EXISTS idx_source_segments_page_id ON source_segments(page_id);
CREATE INDEX IF NOT EXISTS idx_translations_seg_id ON translations(seg_id);
CREATE INDEX IF NOT EXISTS idx_user_llm_keys_user_provider ON user_llm_keys(user_id, provider);
```

```sql
-- 001_initial_schema.down.sql
DROP TABLE IF EXISTS translations;
DROP TABLE IF EXISTS source_segments;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS project_metadata;
DROP TABLE IF EXISTS user_llm_keys;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS users;
```

### Health Check Endpoint
```go
// handlers/health.go
type HealthHandler struct {
    db      *pgxpool.Pool
    redis   *redis.Client
    s3      *s3.Client
    bucket  string
    logger  *zap.Logger
}

type HealthStatus struct {
    Status   string            `json:"status"`
    Services map[string]string `json:"services"`
}

func (h *HealthHandler) HandleHealth(c *gin.Context) {
    ctx := c.Request.Context()
    services := make(map[string]string)
    allHealthy := true

    // Check DB
    if err := h.db.Ping(ctx); err != nil {
        services["database"] = "unhealthy"
        allHealthy = false
        h.logger.Error("health check: database unhealthy", zap.Error(err))
    } else {
        services["database"] = "healthy"
    }

    // Check Redis
    if err := h.redis.Ping(ctx).Err(); err != nil {
        services["redis"] = "unhealthy"
        allHealthy = false
        h.logger.Error("health check: redis unhealthy", zap.Error(err))
    } else {
        services["redis"] = "healthy"
    }

    // Check S3 (HeadBucket)
    _, err := h.s3.HeadBucket(ctx, &s3api.HeadBucketInput{Bucket: aws.String(h.bucket)})
    if err != nil {
        services["storage"] = "unhealthy"
        allHealthy = false
        h.logger.Error("health check: s3 unhealthy", zap.Error(err))
    } else {
        services["storage"] = "healthy"
    }

    status := "healthy"
    statusCode := http.StatusOK
    if !allHealthy {
        status = "degraded"
        statusCode = http.StatusServiceUnavailable
    }

    c.JSON(statusCode, HealthStatus{Status: status, Services: services})
}
```

### Input Validation Helpers
```go
// Filename validation: alphanumeric, hyphens, underscores, dots, spaces
var validFilenameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._\- ]{0,254}$`)

func isValidFilename(name string) bool {
    return validFilenameRegex.MatchString(name)
}

// BCP-47 language code whitelist
var allowedLanguages = map[string]bool{
    "en": true, "zh": true, "ja": true, "ko": true,
    "fr": true, "de": true, "es": true, "pt": true,
    "it": true, "ru": true, "ar": true, "hi": true,
    "th": true, "vi": true, "nl": true, "pl": true,
    "sv": true, "da": true, "fi": true, "no": true,
    "tr": true, "id": true, "ms": true, "uk": true,
}

func isValidLanguageCode(code string) bool {
    return allowedLanguages[strings.ToLower(code)]
}
```

### Standardized Error Response
```go
// Consistent error response shape
type ErrorResponse struct {
    Error   string `json:"error"`
    Code    string `json:"code,omitempty"`    // machine-readable code
}

// Usage: keep existing gin.H{"error": "message"} pattern for backward compatibility
// but add code field for new endpoints where useful
```

## State of the Art

| Old Approach (current) | New Approach (Phase 1) | Impact |
|------------------------|------------------------|--------|
| Inline DDL in main.go | golang-migrate with embedded SQL | Versioned, repeatable, team-friendly |
| `AllowAllOrigins: true` | ALLOWED_ORIGINS env var, fail-closed | Prevents cross-origin attacks |
| No rate limiting | Per-IP token bucket on auth routes | Prevents brute force |
| `fmt.Println` / `log.Printf` | zap structured JSON logging | Machine-parseable, leveled |
| Simple `"OK"` health check | JSON per-dependency health check | Load balancer / Docker integration |
| Manual cascade DELETE in handler | ON DELETE CASCADE in schema | Simpler, consistent, fewer bugs |
| Handlers contain SQL directly | Repository layer with interfaces | Testable, single responsibility |
| 10MB upload limit | 50MB with clear error message | Supports larger PDFs |

**Deprecated/outdated:**
- GORM: CONVENTIONS.md says "GORM for database access" but the actual code uses raw pgxpool. Do NOT introduce GORM. Keep using pgxpool with parameterized queries.
- `gin.Default()`: Replace with `gin.New()` + explicit zap middleware.

## Open Questions

1. **pgx5 driver compatibility with golang-migrate**
   - What we know: golang-migrate has a pgx/v5 driver at `github.com/golang-migrate/migrate/v4/database/pgx/v5`
   - What's unclear: Whether the URL scheme needs adjustments for pgxpool connection strings
   - Recommendation: The migrate URL should use `pgx5://` prefix. Test during implementation.

2. **Worker behavior after SQLAlchemy removal**
   - What we know: Worker uses SQLAlchemy ORM for reads/writes throughout pipeline
   - What's unclear: Whether removing just `create_all` is sufficient or if the worker still needs SQLAlchemy as an ORM
   - Recommendation: Only remove the `Base.metadata.create_all(engine)` call and the table-creation side effect. Keep SQLAlchemy as the ORM for the worker -- it reads/writes via ORM models throughout the pipeline.

3. **Existing data during development**
   - What we know: Clean-slate migration, existing data can be recreated
   - What's unclear: Whether docker volume data from development needs manual cleanup
   - Recommendation: Document that developers should `docker compose down -v` to reset volumes before testing migrations.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing (stdlib) |
| Config file | None -- Go test requires no config |
| Quick run command | `cd apps/gateway && go test ./... -count=1 -short` |
| Full suite command | `cd apps/gateway && go test ./... -count=1 -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | CORS rejects non-configured origins | integration | `go test ./... -run TestCORS -count=1` | No -- Wave 0 |
| SEC-02 | Rate limiter blocks rapid auth requests | unit | `go test ./... -run TestRateLimit -count=1` | No -- Wave 0 |
| SEC-03 | Oversized PDF upload returns error | unit | `go test ./... -run TestUploadSize -count=1` | No -- Wave 0 |
| SEC-04 | JWT secret validated at startup | unit | `go test ./... -run TestJWTSecret -count=1` | No -- Wave 0 |
| SEC-05 | Invalid filenames/lang codes rejected | unit | `go test ./... -run TestInputValidation -count=1` | No -- Wave 0 |
| GW-01 | Layered architecture compiles and works | integration | `go test ./... -count=1` | No -- Wave 0 |
| GW-02 | Migrations run without error | unit | `go test ./... -run TestMigration -count=1` | No -- Wave 0 |
| GW-03 | Zap logger produces structured output | unit | `go test ./... -run TestLogger -count=1` | No -- Wave 0 |
| GW-04 | Health endpoint reports all dependencies | integration | `go test ./... -run TestHealth -count=1` | No -- Wave 0 |
| GW-05 | Delete removes S3 objects | unit | `go test ./... -run TestDeleteS3 -count=1` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/gateway && go test ./... -count=1 -short`
- **Per wave merge:** `cd apps/gateway && go test ./... -count=1 -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Test infrastructure: no existing tests in gateway at all
- [ ] `apps/gateway/repository/mock_*.go` -- mock implementations of repository interfaces for unit testing
- [ ] `apps/gateway/handlers/*_test.go` -- handler tests using mock repositories
- [ ] `apps/gateway/testutil/` -- shared test helpers (setup gin test context, etc.)

## Sources

### Primary (HIGH confidence)
- [golang-migrate/migrate v4.19.1](https://pkg.go.dev/github.com/golang-migrate/migrate/v4) -- migration API, Up(), ErrNoChange, iofs source
- [gin-contrib/zap v1.1.6](https://pkg.go.dev/github.com/gin-contrib/zap) -- Ginzap, RecoveryWithZap, Config struct
- [uber-go/zap](https://github.com/uber-go/zap) -- NewProduction, NewDevelopment configs
- [golang.org/x/time/rate](https://pkg.go.dev/golang.org/x/time/rate) -- NewLimiter, Allow(), token bucket
- Existing codebase -- all handler, service, model files read directly

### Secondary (MEDIUM confidence)
- [golang-migrate PostgreSQL programmatic usage guide](https://oneuptime.com/blog/post/2026-01-07-go-database-migrations/view) -- embed pattern, startup integration
- [gin-contrib/zap GitHub](https://github.com/gin-contrib/zap) -- GinzapWithConfig with SkipPaths
- [Per-IP rate limiting patterns](https://www.alexedwards.net/blog/how-to-rate-limit-http-requests) -- cleanup goroutine pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified via official docs, versions confirmed
- Architecture: HIGH -- patterns derived from existing codebase analysis + standard Go practices
- Pitfalls: HIGH -- based on known golang-migrate behavior (dirty state, naming) and direct code analysis
- Migration schema: HIGH -- derived directly from existing inline DDL + SQLAlchemy models

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, 30-day validity)

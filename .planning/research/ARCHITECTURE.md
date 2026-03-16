# Architecture Patterns

**Domain:** Bilingual PDF translation app (Go + Python + React microservices)
**Researched:** 2026-03-15

## Current State Analysis

The app works but has structural debt that blocks testability, resilience, and maintainability:

- **Gateway**: Handlers contain raw SQL, business logic, and HTTP concerns in one function. `DBService` exposes a raw `pgxpool.Pool` -- no repository abstraction. Schema creation is inline in `main.go`.
- **Worker**: Single-threaded blocking loop with no graceful shutdown. Pipeline creates its own DB session bypassing any connection management. Error handling marks the entire job FAILED with no partial recovery.
- **Frontend**: Reasonable structure (pages/components/stores) but no API layer abstraction, no error boundary patterns, no loading/error state management.

## Recommended Architecture

### Target: Three-Layer Restructuring

Restructure each service independently, preserving the existing inter-service contracts (Redis queue format, PostgreSQL schema, REST API shape). This means the frontend, gateway, and worker can be refactored in any order without breaking each other.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Gateway HTTP Layer** | Request parsing, validation, response formatting | Gateway Service Layer |
| **Gateway Service Layer** | Business logic, orchestration | Gateway Repository Layer, Queue, Storage |
| **Gateway Repository Layer** | SQL queries, data mapping | PostgreSQL |
| **Gateway Middleware** | Auth, CORS, rate limiting, request logging | HTTP Layer (wraps handlers) |
| **Worker Consumer** | Queue consumption, job lifecycle, graceful shutdown | Redis, Worker Pipeline |
| **Worker Pipeline** | Orchestrate extraction/context/translation phases | Pipeline Stages, DB |
| **Worker Pipeline Stages** | Individual phase logic (extract, context, translate) | LLM Client, DB |
| **Worker LLM Client** | Unified multi-provider LLM abstraction | External LLM APIs |
| **Frontend Pages** | Route-level containers, data fetching | Frontend Hooks, API Client |
| **Frontend Components** | Presentational UI | Props only |
| **Frontend API Client** | HTTP calls, error normalization | Gateway REST API |
| **Frontend Stores** | Global state (auth, reader, settings) | API Client |

### Data Flow

```
User Browser
    |
    v
[React SPA] --HTTP--> [Gin Gateway]
                           |
                    +------+------+
                    |      |      |
                   SQL   S3    Redis
                    |      |      |
                    v      v      v
               PostgreSQL MinIO  [Python Worker]
                                      |
                                 +----+----+
                                 |    |    |
                              Extract Context Translate
                                           |
                                        LLM APIs
```

**Unchanged contracts** (do not modify during restructuring):
1. Redis queue key: `tasks:process_pdf` with `JobPayload` JSON
2. PostgreSQL schema: `documents`, `pages`, `source_segments`, `translations`, `project_metadata`
3. REST API routes: `/api/auth/*`, `/api/upload`, `/api/documents/*`, `/api/llm-keys/*`
4. JWT token format: HS256 with `userID` claim

## Patterns to Follow

### Pattern 1: Go Gateway -- Repository/Service/Handler Layers

**What:** Separate the gateway into three layers with clear dependency direction: Handler -> Service -> Repository. Each layer has a single responsibility.

**When:** Apply to all gateway handlers. Start with `DocumentHandler` (most complex queries) then `UploadHandler`.

**Target directory structure:**
```
apps/gateway/
  internal/
    handler/          # HTTP handlers (parse request, call service, write response)
      auth.go
      document.go
      upload.go
      llmkeys.go
      models_handler.go
    service/          # Business logic (orchestration, validation rules)
      auth.go
      document.go
      upload.go
      llmkeys.go
    repository/       # Data access (SQL queries, row scanning)
      user.go
      document.go
      llmkey.go
    middleware/        # HTTP middleware (auth, cors, rate limit, logging)
      auth.go
      cors.go
      ratelimit.go
    model/            # Domain structs (shared across layers)
      user.go
      document.go
      job.go
  pkg/
    crypto/           # Encryption utilities
    storage/          # S3 client wrapper
    queue/            # Redis queue client
  migrations/         # SQL migration files (numbered)
    001_initial.sql
    002_add_llm_keys.sql
  main.go             # Wire everything together
```

**Example -- Repository layer:**
```go
// internal/repository/document.go
type DocumentRepository struct {
    pool *pgxpool.Pool
}

func (r *DocumentRepository) FindByIDAndUser(ctx context.Context, docID, userID string) (*model.Document, error) {
    var doc model.Document
    err := r.pool.QueryRow(ctx,
        "SELECT id, user_id, original_name, s3_key, status, target_lang, llm_provider, llm_model, created_at FROM documents WHERE id = $1 AND user_id = $2",
        docID, userID,
    ).Scan(&doc.ID, &doc.UserID, &doc.OriginalName, &doc.S3Key, &doc.Status, &doc.TargetLang, &doc.LLMProvider, &doc.LLMModel, &doc.CreatedAt)
    if err != nil {
        return nil, err
    }
    return &doc, nil
}

func (r *DocumentRepository) GetDocumentTree(ctx context.Context, docID string) ([]model.Page, error) {
    // All the page + segment + translation JOIN logic lives here
}

func (r *DocumentRepository) DeleteCascade(ctx context.Context, docID string) error {
    // Transaction with cascading deletes, all in one place
}
```

**Example -- Service layer:**
```go
// internal/service/document.go
type DocumentService struct {
    docs    *repository.DocumentRepository
    storage *storage.Client
}

func (s *DocumentService) GetDocumentTree(ctx context.Context, docID, userID string) ([]model.Page, error) {
    // Verify ownership
    doc, err := s.docs.FindByIDAndUser(ctx, docID, userID)
    if err != nil {
        return nil, ErrDocumentNotFound
    }
    return s.docs.GetDocumentTree(ctx, doc.ID)
}
```

**Example -- Handler layer:**
```go
// internal/handler/document.go
type DocumentHandler struct {
    svc *service.DocumentService
}

func (h *DocumentHandler) GetDocumentTree(c *gin.Context) {
    docID := c.Param("id")
    userID := c.GetString("userID")

    pages, err := h.svc.GetDocumentTree(c.Request.Context(), docID, userID)
    if err != nil {
        if errors.Is(err, service.ErrDocumentNotFound) {
            c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal error"})
        return
    }
    c.JSON(http.StatusOK, pages)
}
```

### Pattern 2: Go Dependency Injection via Constructor Wiring

**What:** Wire dependencies in `main.go` using constructor functions, not global state. Each struct declares its dependencies explicitly.

**When:** During the gateway restructuring phase.

**Example:**
```go
// main.go
func main() {
    pool := connectDB()

    // Repositories
    userRepo := repository.NewUserRepository(pool)
    docRepo := repository.NewDocumentRepository(pool)
    keyRepo := repository.NewLLMKeyRepository(pool)

    // External services
    s3Client := storage.NewClient(cfg)
    queueClient := queue.NewClient(cfg)

    // Services
    authSvc := service.NewAuthService(userRepo)
    docSvc := service.NewDocumentService(docRepo, s3Client)
    uploadSvc := service.NewUploadService(docRepo, s3Client, queueClient, keyRepo)
    keySvc := service.NewLLMKeyService(keyRepo)

    // Handlers
    authHandler := handler.NewAuthHandler(authSvc)
    docHandler := handler.NewDocumentHandler(docSvc)
    uploadHandler := handler.NewUploadHandler(uploadSvc)
    keyHandler := handler.NewLLMKeyHandler(keySvc)

    // Router
    r := gin.New()
    registerRoutes(r, authHandler, docHandler, uploadHandler, keyHandler)
    r.Run(":8080")
}
```

### Pattern 3: Python Worker -- Graceful Shutdown and Signal Handling

**What:** Replace the bare `while True` loop with signal-aware shutdown that completes the current job before exiting.

**When:** Early in worker restructuring -- this is a prerequisite for safe deployments.

**Example:**
```python
import signal
import threading

class Worker:
    def __init__(self, queue: QueueService, db: DBService):
        self.queue = queue
        self.db = db
        self._shutdown = threading.Event()

    def start(self):
        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)

        print("Worker ready", flush=True)
        while not self._shutdown.is_set():
            try:
                task = self.queue.get_task("tasks:process_pdf", timeout=5)
                if task:
                    self._process(task)
            except Exception as e:
                print(f"Worker loop error: {e}", flush=True)
                if not self._shutdown.is_set():
                    time.sleep(1)

        print("Worker shut down gracefully", flush=True)

    def _handle_signal(self, signum, frame):
        print(f"Received signal {signum}, finishing current job...", flush=True)
        self._shutdown.set()
```

### Pattern 4: Python Pipeline -- Per-Phase Error Isolation

**What:** Each pipeline phase reports its own success/failure. Failed phases can be retried independently. Status updates are granular (EXTRACTING, CONTEXT_GEN, TRANSLATING, COMPLETED, FAILED).

**When:** After graceful shutdown is in place.

**Example:**
```python
class Pipeline:
    PHASES = [
        ("EXTRACTING", PDFExtractor, "extract_and_save"),
        ("CONTEXT_GEN", ContextAgent, "generate_world_bible"),
        ("TRANSLATING", TranslationAgent, "process_document"),
    ]

    def run(self, job: Job):
        for status, agent_cls, method in self.PHASES:
            self.db.update_job_status(job.id, status)
            try:
                agent = agent_cls(self.db_session, llm_client=self.llm_client)
                getattr(agent, method)(job)
            except Exception as e:
                self.db.update_job_status(job.id, f"FAILED_{status}")
                raise PipelineError(phase=status, cause=e)

        self.db.update_job_status(job.id, "COMPLETED")
```

### Pattern 5: SQL Migrations with golang-migrate

**What:** Replace inline `CREATE TABLE IF NOT EXISTS` in `main.go` with numbered SQL migration files managed by golang-migrate.

**When:** Before any schema changes. First migration captures the existing schema as-is.

**Target structure:**
```
apps/gateway/migrations/
  000001_initial_schema.up.sql
  000001_initial_schema.down.sql
  000002_add_cascade_constraints.up.sql
  000002_add_cascade_constraints.down.sql
```

**Rationale:** The current approach of `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE ADD COLUMN IF NOT EXISTS` is fragile -- it cannot handle column type changes, constraint modifications, or table renames. golang-migrate integrates naturally with Go and supports PostgreSQL natively.

### Pattern 6: GitHub Actions Monorepo CI/CD with Path Filters

**What:** One workflow file per service, triggered only when that service's code changes. Shared infrastructure steps (Docker Compose, integration tests) in a separate workflow.

**When:** After all three services have tests.

**Target structure:**
```
.github/workflows/
  gateway.yml        # Triggered on apps/gateway/** changes
  worker.yml         # Triggered on apps/worker/** changes
  web.yml            # Triggered on apps/web/** changes
  deploy.yml         # Triggered on push to main, builds all changed services
```

**Example -- gateway.yml:**
```yaml
name: Gateway CI
on:
  push:
    paths: ['apps/gateway/**']
  pull_request:
    paths: ['apps/gateway/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: cd apps/gateway && go test ./...

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: golangci/golangci-lint-action@v6
        with:
          working-directory: apps/gateway
```

**Deploy workflow** builds Docker images for changed services only, pushes to container registry, then SSHs to the cloud VM to pull and restart via `docker compose up -d`.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Introducing an Interface for Everything
**What:** Creating Go interfaces for every struct before you have multiple implementations.
**Why bad:** Go interfaces are consumer-defined. Premature interfaces add indirection without benefit and make the code harder to navigate.
**Instead:** Define interfaces only at the consumer side and only when needed for testing (mock injection). Repositories can be concrete structs. Services define interfaces for their dependencies only if they need test doubles.

### Anti-Pattern 2: Shared Database Models Between Go and Python
**What:** Trying to keep Go gateway models and Python worker SQLAlchemy models in sync via code generation or shared schema definitions.
**Why bad:** The two services have fundamentally different access patterns. The gateway reads documents/translations (read-heavy). The worker writes pages/segments/translations (write-heavy). Forcing them to share model definitions creates coupling.
**Instead:** Each service owns its own models. The shared contract is the PostgreSQL schema itself, managed by migrations that run from the gateway.

### Anti-Pattern 3: Abstracting the Pipeline Too Early
**What:** Building a plugin architecture or registry pattern for pipeline stages before you have more than 3 stages.
**Why bad:** Over-engineering. The pipeline has exactly 3 stages that execute sequentially. A simple list of function calls is clearer than a registry.
**Instead:** Use the simple phase list pattern shown in Pattern 4. If a fourth phase is needed later, adding it to the list is trivial.

### Anti-Pattern 4: Moving to WebSockets for Status Updates
**What:** Replacing the frontend polling pattern with WebSockets for real-time status.
**Why bad:** Adds significant complexity (connection management, reconnection, state sync) for a feature that updates every few seconds. Polling at 10-second intervals is appropriate for a job that takes minutes.
**Instead:** Keep polling but add granular status values (EXTRACTING, CONTEXT_GEN, TRANSLATING) so the frontend can show meaningful progress without architectural changes.

### Anti-Pattern 5: Horizontal Scaling Before Vertical Optimization
**What:** Adding multiple worker instances, load balancers, or message broker clusters.
**Why bad:** The current bottleneck is LLM API latency, not compute. Adding workers just means more concurrent LLM API calls (which may hit rate limits). The single-VM Docker Compose target does not warrant distributed architecture.
**Instead:** Optimize the single worker: connection pooling, memory management for large PDFs, chunk size tuning. Consider multiple workers only when LLM throughput is proven sufficient.

## Suggested Build Order

Based on dependency analysis, restructure in this order:

### Phase 1: Gateway Foundation (No External Dependencies)
1. **SQL migrations** -- Extract inline schema from `main.go` into migration files. This must happen first because subsequent restructuring may need schema changes.
2. **Repository layer** -- Extract all raw SQL from handlers into repository structs. This is mechanical extraction with no behavior changes.
3. **Service layer** -- Extract business logic from handlers into service structs that call repositories.
4. **Handler layer** -- Reduce handlers to request parsing + service call + response formatting.
5. **Middleware improvements** -- CORS config from env vars, rate limiting on auth routes.

**Rationale:** Gateway restructuring is the most mechanical and lowest-risk change. It does not affect the worker or frontend at all because the REST API contract stays identical.

### Phase 2: Worker Resilience (Depends on Nothing)
1. **Graceful shutdown** -- Signal handling with current-job completion.
2. **Structured logging** -- Replace print statements with Python logging module.
3. **Per-phase status tracking** -- Granular status updates to DB.
4. **Error isolation** -- Per-phase error handling with retry at phase level.
5. **Connection management** -- SQLAlchemy session scoping, connection pool limits.

**Rationale:** Can run in parallel with Phase 1. Worker changes are internal -- the Redis queue contract and DB schema remain the same.

### Phase 3: Frontend Hardening (Depends on Phases 1-2 for Status Values)
1. **API client layer** -- Centralized fetch wrapper with error normalization.
2. **Error boundaries** -- React error boundaries around major page sections.
3. **Loading/error states** -- Consistent loading spinners and error messages.
4. **Progress feedback** -- Use granular status values from Phase 2 to show pipeline progress.

**Rationale:** Depends on Phase 2 for the new granular status values. API client changes do not require gateway API changes (same endpoints, same responses).

### Phase 4: CI/CD and Testing (Depends on Phases 1-3)
1. **Go tests** -- Unit tests for repositories (with test DB) and services (with mocked repos).
2. **Python tests** -- Unit tests for pipeline stages, integration tests for LLM client.
3. **Frontend tests** -- Component tests with Vitest + React Testing Library.
4. **GitHub Actions** -- Per-service CI with path filters.
5. **Deploy workflow** -- Docker build + push + VM deploy via SSH.

**Rationale:** Tests are most valuable after restructuring because the layered architecture makes units testable. CI/CD requires tests to be meaningful.

### Dependency Graph

```
Phase 1 (Gateway) ----+
                       +--> Phase 3 (Frontend) --> Phase 4 (CI/CD + Tests)
Phase 2 (Worker) -----+
```

Phases 1 and 2 are independent and can be worked on in parallel. Phase 3 has a soft dependency on Phase 2 (granular status values). Phase 4 depends on all prior phases having testable structure.

## Scalability Considerations

| Concern | Current (1-10 users) | At 100 users | At 1000 users |
|---------|---------------------|--------------|---------------|
| **Worker throughput** | Single-threaded, adequate | Still adequate (LLM is bottleneck) | Need multiple worker instances with Redis competing consumers |
| **Database connections** | Unbounded pool | Add `max_conns` to pgxpool config | Connection pooler (PgBouncer) in front of PostgreSQL |
| **File storage** | MinIO single-node | MinIO single-node still fine | Move to AWS S3 or managed object storage |
| **Gateway concurrency** | Gin handles well | Gin handles well | Add rate limiting per-user, consider read replicas |
| **Frontend** | Static SPA | Static SPA on CDN | Same, CDN handles scale |

The architecture as designed (Docker Compose on a single VM) comfortably handles 100+ concurrent users. The LLM API is the true bottleneck -- each document translation takes minutes regardless of infrastructure.

## Sources

- Codebase analysis: `apps/gateway/main.go`, `apps/gateway/handlers/document.go`, `apps/gateway/handlers/upload.go`, `apps/gateway/services/database.go`
- Codebase analysis: `apps/worker/main.py`, `apps/worker/pipeline/pipeline.py`, `apps/worker/pipeline/translator.py`
- Codebase analysis: `docker-compose.yml`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`
- Go clean architecture patterns: Based on established Go community conventions (handler/service/repository layering with constructor-based DI). HIGH confidence -- this is the dominant pattern in production Go APIs.
- golang-migrate: Well-established migration tool for Go + PostgreSQL. HIGH confidence.
- GitHub Actions path filters: Native GitHub Actions feature for monorepo CI. HIGH confidence.
- Python signal handling and graceful shutdown: Standard library patterns. HIGH confidence.

---

*Architecture research: 2026-03-15*

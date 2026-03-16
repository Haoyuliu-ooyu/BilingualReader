# Technology Stack

**Project:** BilingualReader Hardening Milestone
**Researched:** 2026-03-15
**Mode:** Ecosystem research for hardening an existing Go+Python+React microservices app
**Overall Confidence:** MEDIUM (training data only, no web search verification available)

## Existing Stack (Keep As-Is)

These are already in use and should not change. Listed for completeness.

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.24.0 | Gateway API |
| Gin | 1.11.0 | HTTP router |
| pgx/v5 | 5.8.0 | PostgreSQL driver |
| go-redis/v9 | 9.17.3 | Redis client |
| aws-sdk-go-v2 | 1.41.1 | S3/MinIO |
| golang-jwt/v5 | 5.3.1 | JWT auth |
| Python | 3.11 | Worker service |
| tenacity | (unpinned) | Retry logic |
| SQLAlchemy | (unpinned) | ORM |
| PyMuPDF | (unpinned) | PDF extraction |
| React | 19.2.3 | Frontend |
| Vite | 6.3.5 | Build tool |
| Zustand | 5.0.11 | State management |
| Tailwind CSS | 4.x | Styling |
| Docker Compose | 3.8 | Orchestration |
| PostgreSQL | 15 | Database |
| Redis | 7 | Task queue |
| MinIO | latest | Object storage |

## New Stack Additions

### Gateway: MVC Restructuring & Hardening

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| golang-migrate/migrate | v4 | Database schema migrations | The gold standard for Go DB migrations. Supports PostgreSQL natively, has CLI and library modes, used by most Go projects. Replaces the inline `CREATE TABLE IF NOT EXISTS` in main.go which cannot handle schema evolution. **Confidence: HIGH** |
| ulule/limiter/v3 | v3 | Rate limiting middleware | Gin-compatible, supports in-memory and Redis-backed stores. The project already has Redis so using Redis-backed rate limiting works across gateway restarts and multiple instances. Better than `tollbooth` which has a less clean Gin integration. **Confidence: MEDIUM** |
| uber-go/zap | v1 | Structured logging | Replace `log.Printf` with structured, leveled logging. Zap is the fastest Go structured logger with zero-allocation in hot paths. Critical for production debugging. **Confidence: HIGH** |
| stretchr/testify | v1 | Testing assertions and mocks | Standard Go testing companion. Provides assert/require helpers and mock generation. Essential since the project has zero tests. **Confidence: HIGH** |

**MVC Pattern (no new dependency):** Restructure `apps/gateway/` into:
```
apps/gateway/
  main.go              # Wiring only
  handlers/            # HTTP layer (already exists, keep)
  services/            # Business logic (already exists, expand)
  repositories/        # NEW: Data access layer (SQL queries)
  models/              # Domain types (already exists)
  middleware/           # Extract from handlers/middleware.go
  migrations/          # NEW: SQL migration files
```

This is not a framework choice -- it is a directory convention. Go convention favors flat packages, but for this codebase size (5+ handlers, 3+ services), a repository layer cleanly separates SQL from business logic and makes unit testing possible with interfaces.

### Gateway: Security

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| gin-contrib/cors | 1.7.6 (already present) | CORS | Already in use. Just needs configuration change from `AllowOrigins: ["*"]` to actual production domain. No new dependency needed. |

**CORS fix** is a config change, not a library change. Set `AllowOrigins` from environment variable, default to `["http://localhost:3000"]` in dev.

**Rate limiting strategy:** Apply to `/api/auth/login` and `/api/auth/register` at 5 req/min per IP. Apply general rate limit of 60 req/min on all other API endpoints.

### Worker: Pipeline Resilience

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tenacity | >=8.2 (pin it) | LLM retry with exponential backoff | Already in requirements.txt but likely underutilized. Pin to `>=8.2` for `retry_if_exception_type` and `before_sleep_log` support. **Confidence: HIGH** |
| structlog | >=24.0 | Structured logging for Python | Mirrors Zap on the Go side. Provides context-rich, JSON-serializable logs. Much better than `print(f"...", flush=True)` throughout the worker. **Confidence: HIGH** |
| pytest | >=8.0 | Testing framework | Standard Python testing. The project has zero tests; pytest is the community default. **Confidence: HIGH** |
| pytest-asyncio | >=0.23 | Async test support | Only needed if worker moves to async patterns later. Include as dev dependency proactively. **Confidence: MEDIUM** |
| pydantic | >=2.5 (pin it) | Data validation | Already in requirements.txt but unpinned. Pin to v2 for better performance and stricter validation. Use for validating LLM responses and task payloads. **Confidence: HIGH** |

**Multi-provider failover pattern (no new dependency):**
```python
# Pseudocode for LLM failover
providers = [primary_provider, fallback_provider_1, fallback_provider_2]
for provider in providers:
    try:
        result = call_llm(provider, prompt)
        validate_response(result)  # Pydantic model
        return result
    except (RateLimitError, TimeoutError, TruncationError):
        log.warning(f"Provider {provider} failed, trying next")
        continue
raise AllProvidersFailedError(...)
```

**Graceful shutdown (no new dependency):** Use Python's `signal` module to catch SIGTERM/SIGINT, set a shutdown flag, and let the current BLPOP cycle complete before exiting. This is standard library -- no package needed.

**Pin ALL Python dependencies:** The current `requirements.txt` has no version pins. This is a deployment risk. Pin everything:
```
redis>=5.0,<6.0
psycopg2-binary>=2.9,<3.0
pymupdf>=1.24,<2.0
boto3>=1.34,<2.0
google-genai>=0.5,<1.0
anthropic>=0.30,<1.0
openai>=1.30,<2.0
pydantic>=2.5,<3.0
tenacity>=8.2,<9.0
SQLAlchemy>=2.0,<3.0
cryptography>=42.0,<44.0
structlog>=24.0,<25.0
```

### Frontend: UI Polish

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sonner | >=1.5 | Toast notifications | Lightweight, unstyled-by-default toast library that works perfectly with Tailwind. Better than react-hot-toast (more actively maintained, better API). Needed for error feedback, success confirmations, and progress updates. **Confidence: MEDIUM** |
| @tanstack/react-query | >=5.50 | Server state management | Replace manual `fetch` + `useState` + `useEffect` polling with proper server state. Gives automatic retries, background refetching, loading/error states, and cache invalidation. Critical for the document status polling workflow. **Confidence: HIGH** |
| vitest | >=2.0 | Testing framework | Vite-native testing. Shares Vite config, fast HMR-based watch mode. The natural choice when already using Vite. Better than Jest for Vite projects. **Confidence: HIGH** |
| @testing-library/react | >=16.0 | Component testing | Standard React component testing. Pairs with vitest. **Confidence: HIGH** |

**What NOT to add:**
- **shadcn/ui:** The app already has its own component patterns with CVA + clsx + tailwind-merge. Adding shadcn would create two competing component systems. Instead, continue the existing pattern.
- **Radix UI primitives directly:** Only add if specific accessible components are needed (e.g., Dialog, Dropdown). Don't add the full suite speculatively.
- **Redux / MobX:** Zustand is already in place and is the right choice for this app's complexity.
- **Axios:** The native `fetch` API is sufficient. Axios adds bundle size for minimal benefit in modern React.

### CI/CD

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A | CI/CD platform | The repo is on GitHub. Actions is free for public repos, generous for private. Native Docker support, matrix builds for multi-service repos. No external service to manage. **Confidence: HIGH** |

**CI Pipeline Structure:**
```yaml
# .github/workflows/ci.yml
# Triggers: push to main, pull requests
jobs:
  gateway-test:
    # go test ./...
    # go vet ./...
  worker-test:
    # pytest
    # mypy (optional, for type checking)
  web-test:
    # npm run lint
    # vitest run
  web-build:
    # npm run build (catches TypeScript errors)
  docker-build:
    # docker compose build (integration smoke test)
    needs: [gateway-test, worker-test, web-test]
```

Key: Use `paths` filter so gateway changes only trigger gateway jobs, etc. This keeps CI fast.

### Deployment: Cloud VM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker Compose | v2 | Production orchestration | Already in use for dev. Use the same compose file with production overrides (`docker-compose.prod.yml`). Simple, no K8s overhead needed at this scale. **Confidence: HIGH** |
| Caddy | >=2.8 | Reverse proxy + automatic TLS | Automatic HTTPS via Let's Encrypt with zero configuration. Simpler than Nginx for single-service deployments. Handles HTTP->HTTPS redirect, TLS cert renewal, and reverse proxying to gateway:8080 and web:3000. **Confidence: HIGH** |
| Watchtower | >=1.7 | Automatic container updates | Monitors Docker Hub / GHCR for new images and restarts containers. Simple CD for a single-VM deployment. Alternative to full SSH-based deployment scripts. **Confidence: MEDIUM** |

**Deployment Architecture:**
```
Cloud VM (EC2 / DigitalOcean / GCP)
  |
  +-- Caddy (ports 80/443, reverse proxy)
  |     |-- bilingual.example.com -> prism-gateway:8080
  |     |-- bilingual.example.com (static) -> prism-web:3000
  |
  +-- Docker Compose (production overlay)
        |-- prism-gateway
        |-- prism-worker
        |-- prism-web
        |-- prism-redis
        |-- prism-db
        |-- prism-minio
```

**What NOT to use:**
- **Kubernetes:** Explicitly out of scope per PROJECT.md. Massive operational overhead for a single-VM deployment.
- **Terraform/Pulumi:** Over-engineered for a single VM. Manual VM provisioning + a deploy script is sufficient.
- **Nginx:** Caddy is simpler for this use case. Nginx requires manual cert management or certbot setup.
- **Traefik:** More complex than needed. Traefik shines in dynamic container environments (K8s, Swarm), not single-VM Docker Compose.

### Observability (Optional, Phase 2+)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Loki + Promtail | latest | Log aggregation | Lightweight alternative to ELK. Pairs with structured logging (Zap + structlog). Only needed if debugging becomes difficult with `docker compose logs`. **Confidence: LOW -- may be unnecessary at current scale** |

**Skip for now:** Prometheus, Grafana, Jaeger. These are valuable but add operational complexity. Start with structured logging to stdout (captured by Docker) and revisit when the app has actual users generating traffic.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| DB Migrations | golang-migrate | goose | golang-migrate has broader adoption, supports both CLI and library usage, better PostgreSQL support |
| Rate Limiting | ulule/limiter | tollbooth | tollbooth's Gin adapter is less maintained; limiter has native Gin middleware |
| Go Logging | uber-go/zap | zerolog | Both excellent; zap has slightly broader ecosystem and better middleware integrations |
| Python Logging | structlog | loguru | structlog produces proper JSON logs for production; loguru is prettier but less structured |
| Toast (React) | sonner | react-hot-toast | sonner is more actively maintained, better animation API, smaller bundle |
| Server State | @tanstack/react-query | SWR | react-query has richer feature set (mutations, optimistic updates, devtools); SWR is simpler but insufficient for the polling/retry patterns needed |
| Testing (React) | vitest | jest | vitest is Vite-native, shares config, much faster in Vite projects |
| Reverse Proxy | Caddy | nginx | Caddy has automatic TLS with zero config; nginx requires manual certbot setup |
| CD | Watchtower | GitHub Actions SSH deploy | Watchtower is simpler for image-based deployment; SSH deploy is more flexible but more fragile |

## Installation

### Gateway (new Go dependencies)
```bash
cd apps/gateway
go get github.com/golang-migrate/migrate/v4
go get github.com/golang-migrate/migrate/v4/database/postgres
go get github.com/golang-migrate/migrate/v4/source/file
go get github.com/ulule/limiter/v3
go get github.com/ulule/limiter/v3/drivers/middleware/gin
go get github.com/ulule/limiter/v3/drivers/store/redis
go get go.uber.org/zap
# Dev/test only
go get github.com/stretchr/testify
```

### Worker (updated requirements.txt with pins)
```bash
# Replace apps/worker/requirements.txt with pinned versions
redis>=5.0,<6.0
psycopg2-binary>=2.9,<3.0
pymupdf>=1.24,<2.0
boto3>=1.34,<2.0
google-genai>=0.5,<1.0
anthropic>=0.30,<1.0
openai>=1.30,<2.0
pydantic>=2.5,<3.0
tenacity>=8.2,<9.0
SQLAlchemy>=2.0,<3.0
cryptography>=42.0,<44.0
structlog>=24.0,<25.0
pytest>=8.0,<9.0
```

### Frontend (new npm dependencies)
```bash
cd apps/web
npm install sonner @tanstack/react-query
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

## Version Confidence

| Technology | Stated Version | Confidence | Notes |
|------------|---------------|------------|-------|
| golang-migrate/v4 | v4 | HIGH | Stable major version, well-established |
| ulule/limiter/v3 | v3 | MEDIUM | Training data only; verify v3 is latest |
| uber-go/zap | v1 | HIGH | Stable for years |
| stretchr/testify | v1 | HIGH | De facto Go testing standard |
| structlog | >=24.0 | MEDIUM | Training data; verify latest minor |
| pytest | >=8.0 | HIGH | Standard, stable |
| sonner | >=1.5 | MEDIUM | Training data; verify latest |
| @tanstack/react-query | >=5.50 | MEDIUM | v5 is stable; verify latest minor |
| vitest | >=2.0 | MEDIUM | Training data; verify latest |
| Caddy | >=2.8 | HIGH | Stable, well-known |
| Watchtower | >=1.7 | MEDIUM | Training data; verify latest |

## Sources

- Training data only (web search and Context7 were unavailable)
- All version numbers should be verified against official package registries before implementation
- Recommendations based on established Go/Python/React ecosystem patterns as of early 2025

---
*Stack research: 2026-03-15*

# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**LLM Providers:**
- OpenAI (ChatGPT) - Translation and context generation
  - SDK/Client: `openai` Python package
  - Auth: User provides API key via Settings UI, encrypted and stored in `user_llm_keys` table
  - Configuration: Model selected by user (e.g., gpt-4o)
  - Implementation: `apps/worker/pipeline/llm_client.py` - LLMClient class handles OpenAI API calls

- Google Gemini - Alternative LLM provider for translation
  - SDK/Client: `google-genai` Python package
  - Auth: User provides API key, encrypted storage in DB
  - Configuration: Model name (e.g., gemini-2.0-flash)
  - Implementation: `apps/worker/pipeline/llm_client.py` - Gemini support in LLMClient._call_gemini()

- Anthropic Claude - Alternative LLM provider for translation
  - SDK/Client: `anthropic` Python package
  - Auth: User provides API key, encrypted storage in DB
  - Configuration: Model name (e.g., claude-sonnet-4-6)
  - Implementation: `apps/worker/pipeline/llm_client.py` - Claude support in LLMClient._call_claude()

**LLM Key Management Flow:**
1. User enters API key in Settings page (`apps/web/src/pages/Settings.tsx`)
2. Frontend encrypts key with AES-256-GCM before sending to gateway (TBD: confirm frontend encryption)
3. Gateway stores encrypted key in `user_llm_keys` table (`apps/gateway/handlers/llmkeys.go`)
4. When processing a PDF, gateway passes encrypted key in Redis job payload
5. Worker decrypts key using `LLM_KEY_ENCRYPTION_SECRET` before calling LLM (`apps/worker/pipeline/crypto.py`)

## Data Storage

**Databases:**
- PostgreSQL 15 (primary data store)
  - Connection: `DB_URL` env var (e.g., `postgres://postgres:prism@prism-db:5432/prism?sslmode=disable`)
  - Client/Driver:
    - Go: `github.com/jackc/pgx/v5` (connection pool via pgxpool)
    - Python: `psycopg2-binary` + `SQLAlchemy` ORM
  - Auto-migration: Tables created by gateway on startup if not exist (`apps/gateway/main.go`)
  - Cascade deletions: documents → pages → source_segments → translations (via foreign keys)

**File Storage:**
- MinIO (S3-compatible object storage) - Stores uploaded PDF files
  - Endpoint: `S3_ENDPOINT` env var (e.g., `http://prism-minio:9000`)
  - Bucket: `S3_BUCKET` env var (default: `raw-documents`)
  - Credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` env vars
  - Client:
    - Go: `github.com/aws/aws-sdk-go-v2/service/s3` (AWS SDK v2)
    - Python: `boto3`
  - Implementation: `apps/gateway/services/storage.go` (NewStorageService, UploadFile methods)
  - Auto-creation: Bucket is created if it doesn't exist on service startup

**Caching:**
- None detected - No Redis caching layer; Redis used only for task queue

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no external provider)
  - Implementation: `apps/gateway/handlers/auth.go` (HandleRegister, HandleLogin, HandleMe)
  - Token generation: `github.com/golang-jwt/jwt/v5` library
  - Signing method: HS256 (HMAC-SHA256)
  - Key: `JWT_SECRET` env var
  - Expiration: 7 days (hardcoded in auth handler)
  - Storage: Browser localStorage (frontend manages token persistence)

**Protected Routes:**
- Middleware: `apps/gateway/handlers/middleware.go` (AuthRequired middleware)
- JWT validation: Bearer token extracted from Authorization header
- Auto-logout: Frontend detects 401 responses and redirects to `/login` (`apps/web/src/lib/api.ts`)

**User Registration:**
- POST `/api/auth/register` - Email + password hashing (bcrypt or similar; verify in auth.go)
- Credentials stored in `users` table

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, DataDog, or similar integration

**Logs:**
- stdout/stderr - All services log to console
  - Gateway: `log` package (Go standard library)
  - Worker: `print()` with flush=True
  - Frontend: `console.log` (React/browser dev tools)
- Docker Compose: Logs aggregated via `docker compose logs` command

**Status Monitoring:**
- Health check endpoint: `GET /health` on gateway returns "OK"

## Message Queue

**Task Queue:**
- Redis 7 (message broker for PDF processing jobs)
  - Address: `REDIS_ADDR` env var (e.g., `prism-redis:6379`)
  - Client: `github.com/redis/go-redis/v9` (Go), `redis` Python package
  - Queue name: `tasks:process_pdf`
  - Protocol: RESP (Redis Serialization Protocol)
  - Job payload: JSON object with job_id, s3_key, target_lang, llm_provider, llm_model, encrypted llm_api_key

**Job Flow:**
1. Gateway pushes job onto Redis list via RPush (`apps/gateway/services/queue.go`)
2. Worker consumes job via BLPOP with 5-second timeout (`apps/worker/main.py`)
3. Worker processes and updates status (PROCESSING → COMPLETED or FAILED)
4. Frontend polls gateway REST API for status updates

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local development and single-host deployment)
- No cloud platform specified; infrastructure-agnostic design

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other automation workflow

**Build Process:**
- Docker Compose builds images on demand
- Gateway: Multi-stage Go build (golang:alpine → alpine)
- Worker: Python 3.11-slim base + pip install from requirements.txt
- Frontend: Node 20-alpine + npm ci + npm run build

## Environment Configuration

**Required env vars:**
- `DB_URL` - PostgreSQL connection string
- `REDIS_ADDR` - Redis host:port
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` - MinIO/S3
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - S3 credentials
- `JWT_SECRET` - JWT signing key (must be 32+ chars)
- `LLM_KEY_ENCRYPTION_SECRET` - 64-char hex key for AES-256-GCM
- `VITE_API_URL` - Gateway URL for frontend API calls

**Optional env vars:**
- `PORT` - Gateway server port (default: 8080)
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` - Only used if not stored per-user (legacy path)

**Secrets Location:**
- `.env` file at repo root (git-ignored, never committed)
- Docker Compose can reference `.env` for variable interpolation
- User LLM API keys: Encrypted in PostgreSQL `user_llm_keys` table

**Encryption at Rest:**
- User LLM API keys encrypted with AES-256-GCM before storage
  - Encryption: `apps/gateway/services/crypto.go` (EncryptAPIKey)
  - Decryption: `apps/worker/pipeline/crypto.py` (decrypt_api_key)
  - Key: `LLM_KEY_ENCRYPTION_SECRET` env var (must be 64-char hex string)
  - Nonce: Random, included in ciphertext output

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected - No external services calling back to the application

**Outgoing Webhooks:**
- None detected - No events sent to external services post-processing

## API Response Format

**Content-Type:**
- Application/JSON for all REST endpoints
- Frontend uses `apiFetch()` and `apiFetchJSON()` helpers (`apps/web/src/lib/api.ts`)

**Error Responses:**
- Non-OK responses include `{ error: "message" }` in JSON body
- Frontend throws with error message for debugging

## Rate Limiting & Quotas

**Rate Limiting:**
- None detected - No rate limiting middleware or API gateway protection

**LLM API Quotas:**
- Managed per user via their own API keys (delegated to external LLM providers)
- Worker includes retry logic via `tenacity` library for transient failures

## Dependency Health & Updates

**Outdated Packages (as of 2026-03-15):**
- All major versions are relatively recent (Go 1.24, Python 3.11, Node 20, React 19)
- Consider upgrading frontend deps periodically (Vite 6.3, Tailwind 4 are latest)

**Security Considerations:**
- LLM API keys encrypted in transit and at rest
- JWT tokens expire after 7 days
- CORS configured to allow all origins (`AllowOrigins: []string{"*"}`) - **should be restricted in production**
- No HTTPS enforcement in gateway (HTTP only by default)

---

*Integration audit: 2026-03-15*

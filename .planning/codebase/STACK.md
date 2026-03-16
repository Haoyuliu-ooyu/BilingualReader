# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- Go 1.24.0 - Gateway REST API service
- Python 3.11 - Worker service for PDF processing and translation pipeline
- TypeScript 5 - Frontend React application
- JavaScript (ES modules) - Vite configuration and build

**Secondary:**
- SQL - PostgreSQL schema and queries
- Bash/Shell - Docker entrypoints and build scripts

## Runtime

**Environment:**
- Go 1.24.0 - Compiles to native binary, runs on Alpine Linux
- Python 3.11-slim - Docker image for worker process
- Node.js 20 LTS - Frontend development and build (Alpine variant)

**Package Manager:**
- Go Modules - Gateway dependencies managed via `go.mod`/`go.sum`
- npm - Frontend JavaScript dependencies via `package.json` and `package-lock.json`
- pip - Python dependencies via `requirements.txt`

**Lockfile:**
- `apps/gateway/go.sum` - Present
- `apps/web/package-lock.json` - Present (npm ci for deterministic installs)
- `apps/worker/` - No lock file for Python (pip install from requirements.txt)

## Frameworks

**Core:**
- Gin 1.11.0 - Go HTTP router and middleware for REST API (`github.com/gin-gonic/gin`)
- React 19.2.3 - Frontend component library and SPA framework
- Vite 6.3.5 - Frontend build tool and dev server (ES module bundler)
- Pydantic - Python data validation (implicit via pipeline/models.py patterns)

**Testing:**
- None detected - No test files or test framework configuration found

**Build/Dev:**
- TypeScript 5 - Frontend type checking (tsc -b before vite build)
- ESLint 9 - Frontend linting with Next.js config presets
- TailwindCSS 4 - Frontend styling framework with PostCSS plugin
- PostCSS with @tailwindcss/postcss plugin - CSS processing pipeline

## Key Dependencies

**Critical - Gateway (Go):**
- `github.com/jackc/pgx/v5` v5.8.0 - PostgreSQL connection pool (replaces lib/pq)
- `github.com/redis/go-redis/v9` v9.17.3 - Redis client for task queue
- `github.com/aws/aws-sdk-go-v2` v1.41.1 + S3 service v1.96.0 - S3/MinIO object storage
- `github.com/golang-jwt/jwt/v5` v5.3.1 - JWT token generation/validation for auth
- `golang.org/x/crypto` v0.48.0 - AES-256-GCM encryption for LLM API keys

**Critical - Worker (Python):**
- `openai` - OpenAI ChatGPT API client
- `anthropic` - Anthropic Claude API client
- `google-genai` - Google Gemini API client
- `pymupdf` (fitz) - PDF extraction and text parsing (PyMuPDF 1.x)
- `boto3` - AWS S3 / MinIO client
- `psycopg2-binary` - PostgreSQL adapter for Python
- `redis` - Redis client for queue consumption
- `SQLAlchemy` - ORM layer (for database interactions in pipeline)
- `cryptography` - Encryption/decryption of API keys
- `tenacity` - Retry logic for resilience
- `requests` - HTTP client library

**Critical - Frontend (React/TypeScript):**
- `react-pdf` 10.3.0 - PDF rendering component (`react-pdf`)
- `zustand` 5.0.11 - Lightweight state management (auth store, reader store, settings store)
- `react-router-dom` 7.6.1 - Client-side routing and navigation
- `tailwind-merge` 3.4.1 - Conditional Tailwind class merging utility
- `framer-motion` 12.34.0 - Animation library (motion components)
- `lucide-react` 0.564.0 - Icon library
- `class-variance-authority` 0.7.1 - Utility for styling component variants
- `clsx` 2.1.1 - Conditional className builder

**Infrastructure:**
- `github.com/gin-contrib/cors` v1.7.6 - CORS middleware for Gin
- `google.uuid` v1.6.0 - UUID generation for IDs

## Configuration

**Environment:**
- `.env.example` - Template for required environment variables
- `.env` - Runtime configuration (local development only, not committed)

**Key Configurations Required:**
- `REDIS_ADDR` - Redis connection address (default: localhost:6379)
- `DB_URL` - PostgreSQL connection string
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` - MinIO/S3 configuration
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - S3 credentials
- `JWT_SECRET` - HMAC key for HS256 JWT signing
- `LLM_KEY_ENCRYPTION_SECRET` - 64-char hex key for AES-256-GCM encryption of user LLM API keys
- `VITE_API_URL` - Gateway URL exposed to frontend (default: http://localhost:8080)
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` - Optional; stored per-user instead

**Build:**
- `tsconfig.json` - TypeScript configuration (ES2020 target, strict mode, path aliases `@/*`)
- `vite.config.ts` - Vite build configuration (React plugin, port 3000, PostCSS)
- `postcss.config.mjs` - PostCSS configuration with Tailwind plugin
- `eslint.config.mjs` - ESLint with Next.js core web vitals + TypeScript presets

**Frontend Path Alias:**
- `@/` resolves to `apps/web/src/` (configured in tsconfig.json and vite.config.ts)

## Platform Requirements

**Development:**
- Docker & Docker Compose - Orchestrates all services and infrastructure
- Go 1.24+ - Building gateway
- Python 3.11+ - Running worker
- Node 20+ - Running frontend dev server
- PostgreSQL 15 client (optional, for direct DB access)
- Redis 7 CLI (optional, for queue inspection)

**Production:**
- Docker + Kubernetes or Docker Compose on a server
- PostgreSQL 15+ database
- Redis 7+ instance
- MinIO or AWS S3 object storage
- Public DNS/hostname for the gateway service

## Database Schema

**PostgreSQL 15 Tables (auto-created by gateway):**
- `users` - Authentication (id, email, password_hash, created_at)
- `documents` - PDF metadata (id, user_id, original_name, s3_key, status, target_lang, result JSONB, llm_provider, llm_model, created_at)
- `user_llm_keys` - Encrypted per-user LLM API keys (id, user_id, provider, encrypted_key, key_hint, updated_at; unique constraint on user_id+provider)

**Connection:**
- Go gateway: `github.com/jackc/pgx/v5` connection pool
- Python worker: psycopg2 via SQLAlchemy ORM

## Deployment

**Containerization:**
- All services containerized (Dockerfile in each `apps/*/Dockerfile`)
- Gateway: Alpine-based Go binary (multi-stage build)
- Worker: Python 3.11-slim with requirements.txt
- Frontend: Node 20-Alpine with npm ci for lockfile-based installs

**Orchestration:**
- Docker Compose (docker-compose.yml at repo root)
  - Services: prism-gateway, prism-worker, prism-web, prism-redis, prism-db, prism-minio
  - Networks: prism-network (bridge)
  - Volumes: redis_data, postgres_data, minio_data

---

*Stack analysis: 2026-03-15*

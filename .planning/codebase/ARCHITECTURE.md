# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Event-driven microservices with three independent services communicating through message queues and a shared database.

**Key Characteristics:**
- Service isolation via Redis (message queue) and PostgreSQL (shared state)
- Asynchronous PDF processing pipeline triggered by user upload
- Modular LLM abstraction supporting multiple providers (OpenAI, Gemini, Claude)
- JWT-based authentication with encrypted API key management
- Frontend polling pattern for long-running async operations

## Layers

**Gateway Service (Go):**
- Purpose: REST API layer handling user authentication, file uploads, and document retrieval. Acts as orchestrator for pushing jobs to worker.
- Location: `apps/gateway/`
- Contains: HTTP handlers, database service, storage service (S3), queue service (Redis)
- Depends on: PostgreSQL, Redis, MinIO S3
- Used by: Frontend web application

**Worker Service (Python):**
- Purpose: Consumes async PDF processing jobs from Redis queue. Executes 3-phase pipeline: extraction → context generation → translation.
- Location: `apps/worker/`
- Contains: Pipeline modules (extractor, context_agent, translator), LLM client abstraction, database service, queue service
- Depends on: PostgreSQL, Redis, MinIO S3, external LLM APIs
- Used by: Triggered by gateway via Redis job queue

**Web Service (React/TypeScript):**
- Purpose: Single-page application for user interaction. Handles authentication, document upload, and bilingual PDF viewing with polling for processing status.
- Location: `apps/web/`
- Contains: Pages, components, hooks, Zustand stores
- Depends on: Gateway API, browser storage (localStorage)
- Used by: End users via browser

## Data Flow

**Document Upload Flow:**

1. User authenticates via login form → gateway `/api/auth/login`
2. Frontend receives JWT token, stores in auth store
3. User selects PDF, target language, LLM provider/model via FileUpload component
4. Frontend POST to `/api/upload` with multipart file + query params (target_lang, llm_provider, llm_model)
5. Gateway validates file (PDF only, ≤10MB), retrieves/encrypts user's saved LLM API key
6. Gateway stores file to MinIO S3 at path `{userId}/{jobId}.pdf`
7. Gateway inserts document metadata to PostgreSQL `documents` table with status=PENDING
8. Gateway pushes JobPayload to Redis queue `tasks:process_pdf`
9. **Async:** Worker consumes job from Redis, decrypts API key, downloads PDF from S3
10. Worker Phase 1: PDFExtractor parses PDF with PyMuPDF, saves text blocks with bboxes to DB (pages, source_segments tables)
11. Worker Phase 2: ContextAgent sends extracted text to LLM, generates "World Bible" (glossary + style guide) → stored as JSON
12. Worker Phase 3: TranslationAgent chunks segments, translates using LLM with checkpointing → fills translations table
13. Worker marks document status=COMPLETED in DB
14. **Frontend:** Uses `useDocumentPolling` hook (10s interval) to poll `/api/documents` list until status reaches COMPLETED or FAILED
15. User navigates to document → `/reader/:id` fetches document tree (pages → blocks → translations) + PDF blob from gateway
16. PDFViewer renders PDF while TranslationPanel overlays translations synchronized to spatial layout

**State Management:**

- **Auth:** `useAuthStore` (Zustand) persists JWT token and user info to localStorage
- **Reader:** `useReaderStore` (Zustand) holds current job, pages, blocks, highlighted block state
- **Settings:** `useSettingsStore` (Zustand) manages user's saved LLM provider keys (encrypted)
- **Server state:** PostgreSQL is source of truth for all document/user data; frontend polls gateway for updates

## Key Abstractions

**LLMClient:**
- Purpose: Unified interface across OpenAI, Gemini, and Claude SDKs
- Examples: `apps/worker/pipeline/llm_client.py`
- Pattern: Config-driven instantiation (provider, model, api_key injected at runtime); single `generate()` method dispatches to provider-specific implementation; supports JSON mode and temperature control

**JobPayload:**
- Purpose: Message envelope for Redis queue containing all context needed for worker to process PDF
- Examples: `apps/gateway/models/payload.go`
- Pattern: Struct with job_id, user_id, s3_key, target_lang, llm_provider, llm_model, encrypted llm_api_key

**PDFExtractor:**
- Purpose: Spatial text extraction and storage
- Examples: `apps/worker/pipeline/extractor.py`
- Pattern: Class method that iterates PDF pages, extracts text blocks with bounding boxes (PyMuPDF), saves records to DB with parent-child relationships (Document → Pages → SourceSegments)

**TranslationAgent:**
- Purpose: Chunk-based translation with checkpointing
- Examples: `apps/worker/pipeline/translator.py`
- Pattern: Reads untranslated segments, sends to LLM in batches, writes translations to DB only after successful response (idempotent on retry)

## Entry Points

**Gateway:**
- Location: `apps/gateway/main.go`
- Triggers: Docker startup or direct Go binary execution
- Responsibilities: Initialize DB (create tables if not exist), initialize services (DB, Storage, Queue), register HTTP handlers, start Gin server on port 8080

**Worker:**
- Location: `apps/worker/main.py`
- Triggers: Docker startup or direct Python execution
- Responsibilities: Initialize services (DB, Queue), enter blocking loop: `queue.get_task("tasks:process_pdf", timeout=5)`, call `process_task()`

**Web:**
- Location: `apps/web/src/main.tsx` (React entry) + `apps/web/src/App.tsx` (routing root)
- Triggers: `npm run dev` (Vite dev server) or built bundle serving on port 3000
- Responsibilities: Initialize auth store from localStorage, render router with login gate, conditionally show sidebar for authenticated users

## Error Handling

**Strategy:** Fail-fast with logging; no retry loop at service level (job can be reprocessed by user or by worker queue timeout).

**Patterns:**

- **Gateway upload failures:** Return HTTP error with user-friendly message; log to stdout; do not insert DB record or queue job
- **Worker pipeline failures:** Catch Exception, log full traceback, update document status=FAILED in DB, mark job as processed (consumed from queue)
- **LLM API errors:** Worker logs error and marks document FAILED; user can retry upload with different settings
- **Database errors:** Log and propagate; gateway returns 500; worker marks document FAILED
- **JWT validation failure:** Return 401 Unauthorized; frontend auto-logs out and redirects to login

## Cross-Cutting Concerns

**Logging:** All services use standard stdout logging (Go `log.Printf`, Python `print` with flush=True for container visibility). Worker adds "===" markers for pipeline phases.

**Validation:** Gateway validates file type (PDF only) and size (≤10MB); ensures LLM provider and model are specified; validates JWT on all protected routes via `AuthRequired()` middleware.

**Authentication:** JWT (HS256, 7-day expiry) issued by gateway on successful login; token stored in frontend auth store and sent as `Authorization: Bearer <token>` header on all API calls. Invalid/expired tokens cause 401 response and auto-logout.

**Encryption:** User-provided LLM API keys encrypted with AES-256-GCM (key: `LLM_KEY_ENCRYPTION_SECRET` env var) before being passed through Redis to worker. Worker decrypts keys using same secret before calling LLM APIs.

---

*Architecture analysis: 2026-03-15*

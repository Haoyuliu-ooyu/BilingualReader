# BilingualReader

## What This Is

A web application that translates PDFs into bilingual documents. Users upload a PDF, choose a target language and LLM provider, and receive a side-by-side bilingual view with the original and translated text spatially aligned. Built as three microservices: Go REST gateway, Python translation worker, and React SPA frontend.

## Core Value

The translation output must be accurate, consistent, and complete — every segment translated with proper glossary/style coherence across the document.

## Requirements

### Validated

- ✓ User authentication (email/password, JWT sessions) — existing
- ✓ PDF upload with S3 storage — existing
- ✓ Multi-provider LLM support (OpenAI, Gemini, Claude) — existing
- ✓ 3-phase pipeline: extraction → context/glossary → translation — existing
- ✓ Encrypted API key management (AES-256-GCM) — existing
- ✓ Bilingual PDF viewer with spatial alignment — existing
- ✓ Translation checkpointing for resumability — existing
- ✓ Per-user LLM provider/key configuration — existing
- ✓ Docker Compose orchestration — existing

### Active

- [ ] Frontend layout polish and visual refinement
- [ ] Frontend functionality gaps (progress feedback, error states, retry)
- [ ] Worker translation accuracy improvements (better prompts, context handling)
- [ ] Worker error recovery (LLM failure handling, retries, partial results)
- [ ] Worker performance optimization (memory, large PDFs, speed)
- [ ] Worker multi-provider improvements (failover, response validation)
- [ ] Gateway MVC restructuring (service/repository separation)
- [ ] Database migration system (replace inline schema creation)
- [ ] Security hardening (rate limiting, CORS config, JWT validation)
- [ ] Graceful shutdown and reconnection logic in worker
- [ ] CI/CD pipeline setup
- [ ] Production deployment configuration for cloud VM

### Out of Scope

- Kubernetes deployment — cloud VM with Docker Compose is the target
- Real-time collaboration — single-user translation tool
- Mobile app — web-only for this milestone
- Multi-language per document — single target language per job

## Context

BilingualReader is a working brownfield application with all core functionality in place. The codebase has no tests, the gateway has minimal structural separation, and several concerns were identified during codebase analysis (see `.planning/codebase/CONCERNS.md`). This milestone focuses on hardening, refining, and preparing for production deployment rather than adding new capabilities.

Key concerns to address:
- CORS wildcard in production
- No rate limiting on auth endpoints
- Inline schema creation (no migrations)
- Translation pipeline silently skipping segments on LLM errors
- Gemini response truncation without detection
- Single-threaded worker with no graceful shutdown
- No frontend tests or backend tests

## Constraints

- **Stack**: Preserve existing Go/Python/React architecture — refactor, don't rewrite from scratch
- **Infrastructure**: PostgreSQL 15, Redis 7, MinIO S3 — keep current infra dependencies
- **Deployment**: Target cloud VM (EC2/GCP/DigitalOcean) with Docker Compose
- **LLM Providers**: Continue supporting OpenAI, Gemini, and Claude

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Translation quality is top priority | Core value — bilingual output is the product | — Pending |
| Gateway rewrite uses MVC pattern | Better testability and separation of concerns | — Pending |
| Deploy to cloud VM, not K8s | Simpler ops for current scale | — Pending |
| CI/CD platform: Claude's discretion | User open to best fit for stack | — Pending |

---
*Last updated: 2026-03-15 after initialization*

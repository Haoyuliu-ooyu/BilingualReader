# Feature Landscape

**Domain:** Production-quality bilingual PDF translation application
**Researched:** 2026-03-15
**Focus:** Hardening existing app for production deployment (not greenfield features)

## Table Stakes

Features users expect from a production translation product. Missing any of these makes the app feel broken or untrustworthy.

### Translation Quality & Reliability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Complete translation guarantee | Users must trust every segment is translated; silent skips destroy confidence | Med | Existing multi-pass retry logic is good but errors still surface as generic "FAILED" with no detail |
| LLM response validation | Malformed or partial LLM output must be detected and retried, never silently accepted | Med | Pydantic validation exists; need to harden edge cases (truncation, encoding issues) |
| Gemini truncation handling | Gemini MAX_TOKENS truncation must be caught and retried with smaller chunks | Low | Partially implemented -- raises exception but caller catches and moves on |
| Consistent terminology (glossary) | Translation of names/terms must be consistent across the entire document | Med | World Bible/context agent exists; quality depends on prompt engineering |
| Error detail propagation | When translation fails, users need to know WHY (rate limit? bad key? truncation?) | Med | Currently pipeline raises generic exceptions; error reason not stored in DB or shown in UI |
| Retry failed translations | Users must be able to retry a failed document without re-uploading | Low | DB has status field; need a "retry" endpoint and UI button |

### Error Handling UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Granular progress feedback | Users need to see translation progress, not just a spinner | Med | Currently only PROCESSING/COMPLETED/FAILED states; need segment-level or percentage progress |
| Meaningful error messages | "Translation failed" is useless; users need actionable info (e.g., "API key invalid", "Rate limited") | Med | Requires error classification in worker and propagation through DB to frontend |
| Failed state with details | Failed documents should show what went wrong and offer retry | Low | Frontend shows "FAILED" badge but no error message or retry action |
| Upload validation feedback | File type, size limits, and format issues must be caught at upload with clear messages | Low | No file size limit enforcement currently |
| API key validation | Users should know immediately if their LLM key is invalid, not after uploading a document | Med | Currently keys are only tested during translation; add a validation/test endpoint |

### Security Hardening

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CORS restriction | Production must restrict origins to actual domain; wildcard CORS is a security hole | Low | Currently `AllowAllOrigins: true`; change to environment-configured origin |
| Rate limiting on auth endpoints | Login/register without rate limiting enables brute force attacks | Low | Use Gin middleware (e.g., `gin-contrib/limiter` or custom token bucket) |
| File size limits | Unbounded upload enables DoS via large files consuming storage and worker memory | Low | Add max file size at gateway (Gin's `MaxMultipartMemory` + explicit check) |
| JWT secret validation | JWT secret must meet minimum entropy requirements | Low | Validate secret length/entropy at startup |
| Input sanitization | File names, language codes, and user inputs must be sanitized | Low | Prevent path traversal in S3 keys, validate language codes against allowlist |
| HTTPS enforcement | Production traffic must be encrypted | Low | TLS termination via reverse proxy (nginx/Caddy); add HSTS headers |

### Deployment & Ops

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Health checks | All services need health endpoints for monitoring and orchestration | Low | Gateway has `/health`; worker and Redis/DB connectivity need health signals |
| Structured logging | Production needs parseable logs, not print statements | Med | Worker uses `print()` everywhere; switch to structured JSON logging |
| Graceful shutdown | Worker must finish current job before stopping; gateway must drain connections | Med | Worker has no signal handling; `BLPOP` interrupted mid-translation loses progress |
| Database migrations | Schema changes must be versioned and repeatable, not inline `CREATE TABLE IF NOT EXISTS` | Med | Replace inline DDL in `main.go` with migration tool (golang-migrate or goose) |
| Environment-based configuration | All config must come from environment; no hardcoded values | Low | Mostly done; audit remaining hardcoded values |
| Document deletion cleanup | Deleting a document must also remove S3 objects | Low | Currently only deletes DB rows; S3 objects orphaned |
| Redis reconnection | Worker must recover from Redis connection drops without crashing | Low | Currently no reconnection logic on BLPOP failure |

## Differentiators

Features that set the product apart. Not expected by default, but significantly improve the experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| LLM provider failover | Automatically try backup provider if primary fails (e.g., OpenAI rate limited, fall back to Claude) | Med | Requires user to configure multiple providers; adds reliability without user intervention |
| Real-time progress via SSE/WebSocket | Replace 10s polling with server-sent events for instant progress updates | Med | Better UX for long translations; eliminates unnecessary API calls |
| Translation quality scoring | Automatically assess translation quality (back-translation comparison, consistency checks) | High | Unique differentiator; most tools just output translations with no quality signal |
| Segment-level translation editing | Allow users to manually fix individual translated segments post-translation | Med | Valuable for professional use; requires UI for inline editing + DB update endpoint |
| PDF layout preservation in export | Export bilingual document as downloadable PDF with original layout preserved | High | Complex PDF generation; major value for users who need to share translated docs |
| Multi-worker horizontal scaling | Run multiple worker instances for concurrent job processing | Med | Requires Redis-based job locking to prevent double-processing; enables handling load |
| Translation memory / caching | Cache translations of identical segments across documents to save LLM costs | Med | Reduces API costs for users translating similar documents; requires segment hashing |
| Batch upload | Upload and translate multiple PDFs in one action | Low | Convenience feature; mostly frontend work with queue handling |

## Anti-Features

Features to explicitly NOT build for this milestone. These add complexity without matching the product's focus.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time collaborative editing | Single-user tool; collaboration adds massive complexity (OT/CRDT, presence, permissions) | Keep as single-user with clean per-user document isolation |
| Custom ML translation models | Training/hosting custom models is an entirely different product; BYO-LLM is the model | Continue multi-provider LLM abstraction; let users choose their preferred provider |
| Mobile app | Limited audience benefit for document translation; responsive web covers mobile viewing | Ensure responsive design works on tablets for reading |
| Kubernetes deployment | Over-engineered for current scale; Docker Compose on a VM is appropriate | Use Docker Compose with proper health checks and restart policies |
| Multi-language per document | Translating one document to multiple languages simultaneously adds queue/UI complexity | Support sequential re-translation with a different target language |
| OAuth/social login | Email/password auth is sufficient for this user base; OAuth adds provider dependencies | Keep email/password; ensure secure password hashing and rate limiting |
| Webhook/API integration | Building a public API adds auth complexity, versioning burden, and documentation overhead | Keep as a web-only product; consider API later if demand emerges |
| Admin dashboard | No multi-tenant management needed; single-user or small-team tool | Use structured logs and health endpoints for ops visibility |

## Feature Dependencies

```
CORS restriction ──────────────────────> Production deployment
Rate limiting ─────────────────────────> Production deployment
HTTPS enforcement ─────────────────────> Production deployment
JWT secret validation ─────────────────> Production deployment

Database migrations ───────────────────> Any schema changes
                                         (must be in place before other DB work)

Structured logging ────────────────────> Graceful shutdown
                                         (need logs to debug shutdown behavior)

Error detail propagation ──────────────> Meaningful error messages (frontend)
                                         Retry failed translations (frontend)

Granular progress feedback ────────────> Real-time SSE/WebSocket (differentiator)
                                         (polling progress first, then upgrade transport)

Graceful shutdown ─────────────────────> Multi-worker scaling (differentiator)
                                         (single worker must be reliable before scaling)

Redis reconnection ────────────────────> Graceful shutdown
                                         (reconnection is part of resilient worker lifecycle)

LLM response validation ──────────────> LLM provider failover (differentiator)
                                         (must handle single-provider errors before adding failover)

File size limits ──────────────────────> Worker memory optimization
                                         (bounded input enables predictable resource usage)

API key validation ────────────────────> LLM provider failover (differentiator)
                                         (must validate keys before using them in failover chain)
```

## MVP Recommendation

For production hardening, prioritize in this order:

### Phase 1: Security & Stability (must-ship)
1. **CORS restriction** -- trivial fix, critical security gap
2. **Rate limiting on auth** -- prevents brute force, low effort
3. **File size limits** -- prevents DoS, low effort
4. **JWT secret validation** -- startup check, low effort
5. **Graceful shutdown** -- prevents data loss during deploys
6. **Redis reconnection** -- prevents worker crashes in production

### Phase 2: Developer Infrastructure
1. **Database migrations** -- blocks all future schema work
2. **Structured logging** -- required for production debugging
3. **Health checks** -- required for deployment orchestration
4. **Environment config audit** -- eliminate hardcoded values

### Phase 3: Translation Quality & UX
1. **Error detail propagation** -- store error reasons in DB, show in UI
2. **Retry failed translations** -- endpoint + UI button
3. **Granular progress feedback** -- percentage or segment count in DB, poll from frontend
4. **API key validation** -- test endpoint before wasting user time on upload
5. **Document deletion cleanup** -- fix S3 orphan bug

### Phase 4: Deployment
1. **HTTPS via reverse proxy** -- Caddy or nginx for TLS termination
2. **Docker Compose production config** -- separate prod compose file with restart policies
3. **CI/CD pipeline** -- automated build, test, deploy

### Defer to future milestone:
- **LLM provider failover** -- nice to have but requires multi-provider config UX
- **Real-time SSE/WebSocket** -- polling works; optimize later
- **Translation quality scoring** -- high complexity, research-heavy
- **Segment-level editing** -- full feature, not a hardening item
- **PDF export** -- full feature, not a hardening item
- **Multi-worker scaling** -- single worker is fine for current load

## Sources

- Codebase analysis of BilingualReader repository (primary source)
- `.planning/PROJECT.md` -- project requirements and constraints
- `.planning/codebase/CONCERNS.md` -- identified technical debt and security issues
- Domain knowledge: production deployment checklists, OWASP security guidelines, 12-factor app methodology
- Confidence: HIGH for table stakes and anti-features (grounded in codebase analysis and established production patterns); MEDIUM for differentiators (based on domain knowledge of translation tools, not verified against specific competitors)

# Requirements: BilingualReader

**Defined:** 2026-03-15
**Core Value:** The translation output must be accurate, consistent, and complete — every segment translated with proper glossary/style coherence across the document.

## v1 Requirements

### Security

- [x] **SEC-01**: Gateway restricts CORS to environment-configured origins instead of wildcard
- [x] **SEC-02**: Login and register endpoints are rate-limited to prevent brute force attacks
- [x] **SEC-03**: Gateway enforces maximum PDF file size at upload with clear error message
- [x] **SEC-04**: JWT secret is validated for minimum length/entropy at startup
- [x] **SEC-05**: File names, language codes, and user inputs are sanitized to prevent injection

### Gateway Architecture

- [x] **GW-01**: Gateway restructured into handler/service/repository layers with dependency injection
- [x] **GW-02**: Database schema managed via versioned migration tool (golang-migrate), replacing inline DDL
- [x] **GW-03**: Gateway uses structured logging (zap) instead of fmt/log Printf
- [x] **GW-04**: Gateway exposes health check endpoint reporting DB, Redis, and S3 connectivity
- [x] **GW-05**: Document deletion also removes associated S3 objects

### Worker Resilience

- [x] **WRK-01**: Worker handles OS signals (SIGTERM/SIGINT) for graceful shutdown, finishing current job before exit
- [x] **WRK-02**: Worker automatically reconnects to Redis after connection drops
- [x] **WRK-03**: Worker uses structured logging (structlog) instead of print statements
- [x] **WRK-04**: Worker propagates specific error reasons (rate limit, auth failure, truncation) to document status in DB
- [x] **WRK-05**: Worker reports segment-level translation progress to DB (percentage or segment count)
- [x] **WRK-06**: Worker classifies LLM exceptions and only retries on transient errors (not auth failures)

### Translation UX

- [x] **TUX-01**: User can retry a failed translation from the frontend without re-uploading
- [x] **TUX-02**: User sees granular translation progress (segment count or percentage) during processing
- [x] **TUX-03**: User sees specific error reason when translation fails (not generic "FAILED")

### Frontend

- [ ] **FE-01**: Frontend layout is polished with proper spacing, alignment, and visual refinement
- [x] **FE-02**: Frontend has error boundaries with informative error states
- [x] **FE-03**: Frontend uses React Query for server state management, replacing manual polling
- [x] **FE-04**: Frontend displays translation progress from worker (percentage/segments)
- [ ] **FE-05**: Frontend provides retry button for failed documents

### Deployment

- [ ] **DEP-01**: HTTPS configured via Caddy reverse proxy with automatic TLS certificates
- [ ] **DEP-02**: Production Docker Compose config with restart policies, health checks, and no dev volume mounts
- [ ] **DEP-03**: CI/CD pipeline via GitHub Actions with per-service path filtering (build, test, deploy)

## v2 Requirements

### Translation Enhancement

- **TENH-01**: LLM provider failover — automatically try backup provider if primary fails
- **TENH-02**: API key validation endpoint — test key validity before starting translation
- **TENH-03**: Translation quality scoring — automatic quality assessment of translations

### Real-time UX

- **RTUX-01**: Replace polling with SSE/WebSocket for real-time progress updates
- **RTUX-02**: Segment-level translation editing — users can fix individual segments

### Scaling

- **SCALE-01**: Multi-worker horizontal scaling with Redis-based job locking
- **SCALE-02**: Translation memory/caching — cache identical segments across documents

### Export

- **EXP-01**: Export bilingual document as downloadable PDF with preserved layout

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Single-user tool; CRDT/OT adds massive complexity |
| Custom ML translation models | BYO-LLM is the model; training custom models is a different product |
| Mobile app | Web-only; responsive design covers tablet viewing |
| Kubernetes deployment | Docker Compose on cloud VM is appropriate for current scale |
| OAuth/social login | Email/password sufficient; OAuth adds provider dependencies |
| Multi-language per document | Single target language per job; can re-translate sequentially |
| Public API/webhooks | Web-only product; consider API later if demand emerges |
| Admin dashboard | Use structured logs and health endpoints for ops visibility |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| GW-01 | Phase 1 | Complete |
| GW-02 | Phase 1 | Complete |
| GW-03 | Phase 1 | Complete |
| GW-04 | Phase 1 | Complete |
| GW-05 | Phase 1 | Complete |
| WRK-01 | Phase 2 | Complete |
| WRK-02 | Phase 2 | Complete |
| WRK-03 | Phase 2 | Complete |
| WRK-04 | Phase 2 | Complete |
| WRK-05 | Phase 2 | Complete |
| WRK-06 | Phase 2 | Complete |
| TUX-01 | Phase 3 | Complete |
| TUX-02 | Phase 3 | Complete |
| TUX-03 | Phase 3 | Complete |
| FE-01 | Phase 3 | Pending |
| FE-02 | Phase 3 | Complete |
| FE-03 | Phase 3 | Complete |
| FE-04 | Phase 3 | Complete |
| FE-05 | Phase 3 | Pending |
| DEP-01 | Phase 4 | Pending |
| DEP-02 | Phase 4 | Pending |
| DEP-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*

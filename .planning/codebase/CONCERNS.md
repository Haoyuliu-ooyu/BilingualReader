# Codebase Concerns

## Tech Debt

| Area | Description | File(s) |
|------|-------------|---------|
| CORS wildcard | CORS configured with `AllowAllOrigins: true` in production | `apps/gateway/main.go` |
| Inline schema creation | Database schema created inline in `main.go` instead of migration files | `apps/gateway/main.go` |
| Missing JWT validation | JWT secret not validated for minimum length/entropy | `apps/gateway/handlers/middleware.go` |
| Plaintext keys in memory | Decrypted LLM API keys held in memory during worker processing | `apps/worker/pipeline/llm_client.py` |
| No database migrations | Schema changes require manual SQL or full recreation | `apps/gateway/main.go` |
| Hardcoded config values | Some configuration values hardcoded rather than environment-driven | Various |

## Known Bugs

| Bug | Impact | File(s) |
|-----|--------|---------|
| Incomplete translations | Translation pipeline may silently skip segments on LLM errors | `apps/worker/pipeline/translation_agent.py` |
| Gemini response truncation | Long responses from Gemini API may be truncated without detection | `apps/worker/pipeline/llm_client.py` |
| Text extraction gaps | PyMuPDF extraction can miss text in complex PDF layouts (tables, columns) | `apps/worker/pipeline/pdf_extraction.py` |

## Security Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Key management | Medium | User LLM API keys encrypted with AES-256-GCM but decrypted keys live in worker memory |
| No rate limiting on auth | Medium | Login/register endpoints lack rate limiting, vulnerable to brute force |
| HTTPS not enforced | Medium | No TLS termination configured, relies on external proxy |
| CORS wildcard | Low | `AllowAllOrigins` permits any domain to make API requests |

## Performance Bottlenecks

| Bottleneck | Description |
|------------|-------------|
| Frontend polling | SPA polls gateway for document status on fixed interval instead of WebSocket/SSE |
| Translation memory usage | Large PDFs load all segments into memory during translation |
| Single-threaded worker | Worker processes one job at a time via `BLPOP`, no concurrency |

## Fragile Areas

| Area | Risk | File(s) |
|------|------|---------|
| Checkpoint logic | Resume logic depends on exact segment ID matching; schema changes break checkpoints | `apps/worker/pipeline/translation_agent.py` |
| LLM output parsing | String parsing of LLM responses is brittle; format changes cause silent failures | `apps/worker/pipeline/context_agent.py`, `apps/worker/pipeline/translation_agent.py` |
| No graceful shutdown | Worker has no signal handling; killing mid-translation loses progress since last checkpoint | `apps/worker/main.py` |
| Redis connection | No reconnection logic if Redis connection drops during `BLPOP` | `apps/worker/main.py` |

## Scaling Limits

| Limit | Description |
|-------|-------------|
| Single worker | Only one worker instance processes jobs; no horizontal scaling support |
| Connection pooling | Database connections not pooled in worker; each request opens new connection |
| No job prioritization | Redis queue is FIFO only; no priority lanes for small vs large documents |
| File size limits | No enforcement of maximum PDF file size at upload |

## Missing Features

| Feature | Impact |
|---------|--------|
| Job resumption UI | Users cannot retry or resume failed translations from frontend |
| Document deletion cleanup | Deleting documents doesn't clean up S3 objects |
| LLM failover | No automatic fallback if primary LLM provider fails |
| Progress granularity | Frontend only knows "processing" vs "done", no segment-level progress |
| Multi-language support | Only supports single target language per translation job |

## Test Coverage Gaps

| Gap | Description |
|-----|-------------|
| No integration tests | No end-to-end tests covering the full upload → translate → retrieve flow |
| No worker tests | Translation pipeline has no unit or integration tests |
| No error path testing | Error handling in LLM client and pipeline untested |
| No concurrent scenario tests | No tests for multiple simultaneous uploads or translations |
| Frontend test absence | No component or E2E tests for the React frontend |

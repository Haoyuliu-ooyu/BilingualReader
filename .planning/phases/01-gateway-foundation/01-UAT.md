---
status: testing
phase: 01-gateway-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-03-16T12:00:00Z
updated: 2026-03-16T12:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running containers. Run `docker compose down -v` to clear volumes. Then `docker compose build && docker compose up`. Gateway boots without errors, migrations run successfully, and `curl http://localhost:8080/health` returns JSON with db/redis/storage status (all "up"). No crash, no migration errors in logs.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Run `docker compose down -v` then `docker compose build && docker compose up`. Gateway boots, migrations run, `curl http://localhost:8080/health` returns JSON with db/redis/storage status. No crashes or migration errors.
result: [pending]

### 2. Health Check Endpoint
expected: `curl http://localhost:8080/health` returns JSON like `{"status":"healthy","database":"up","redis":"up","storage":"up"}` with HTTP 200. No authentication required.
result: [pending]

### 3. CORS Rejection
expected: `curl -i -H "Origin: http://evil.com" http://localhost:8080/api/auth/login` should NOT have `Access-Control-Allow-Origin: http://evil.com` in response headers. Only origins in ALLOWED_ORIGINS env var should be allowed.
result: [pending]

### 4. Rate Limiting on Auth
expected: Send 12 rapid POST requests to `/api/auth/login` (even with bad credentials). After the 10th request within a minute, the gateway should return HTTP 429 (Too Many Requests). Earlier requests should get normal 400/401 responses.
result: [pending]

### 5. File Size Enforcement
expected: Attempt to upload a PDF larger than 50MB via `POST /api/upload`. Gateway returns a clear error message mentioning the 50MB limit (HTTP 400), without processing the file. A PDF under 50MB should upload normally.
result: [pending]

### 6. Structured JSON Logging
expected: Gateway logs in Docker output are structured JSON (not plain text). Each log line has fields like `level`, `ts`, `msg`. Request logs include `method`, `path`, `status`, `latency`. No `fmt.Println` or unstructured output visible.
result: [pending]

### 7. Document Deletion with S3 Cleanup
expected: Upload a document, note its ID. Delete it via `DELETE /api/documents/:id`. The document is removed from the database. Check MinIO/S3 — the PDF object should also be gone (or a warning logged if S3 delete failed).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]

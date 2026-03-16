---
phase: 1
slug: gateway-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (stdlib) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd apps/gateway && go test ./...` |
| **Full suite command** | `cd apps/gateway && go test -v -count=1 ./...` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/gateway && go test ./...`
- **After every plan wave:** Run `cd apps/gateway && go test -v -count=1 ./...`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | GW-02 | integration | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SEC-01 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SEC-02 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | SEC-03 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | SEC-04 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | SEC-05 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | GW-01 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | GW-03 | unit | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | GW-04 | integration | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | GW-05 | integration | `cd apps/gateway && go test ./...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gateway/go.mod` — add testing dependencies if needed
- [ ] Test file stubs for each package created during restructuring

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CORS blocks non-configured origins | SEC-01 | Requires browser/curl with Origin header | `curl -H "Origin: http://evil.com" http://localhost:8080/health` — verify no CORS headers |
| Rate limiting blocks rapid-fire | SEC-02 | Requires rapid sequential requests | Send 15 login requests in 60s — verify 429 after 10th |
| Health check reports all dependencies | GW-04 | Requires running infrastructure | `curl http://localhost:8080/health` — verify JSON with db, redis, s3 status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

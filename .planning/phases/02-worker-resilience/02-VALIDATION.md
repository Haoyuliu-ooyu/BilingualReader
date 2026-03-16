---
phase: 02
slug: worker-resilience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | apps/worker/pytest.ini (Wave 0 installs) |
| **Quick run command** | `cd apps/worker && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd apps/worker && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/worker && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd apps/worker && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | WRK-01 | unit | `pytest tests/test_shutdown.py` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | WRK-02 | unit | `pytest tests/test_reconnection.py` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | WRK-03 | unit | `pytest tests/test_logging.py` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | WRK-04 | unit | `pytest tests/test_error_classification.py` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | WRK-05 | unit | `pytest tests/test_progress.py` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | WRK-06 | unit | `pytest tests/test_llm_retry.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/worker/tests/conftest.py` — shared fixtures (mock DB, mock Redis, mock LLM client)
- [ ] `apps/worker/tests/test_shutdown.py` — stubs for WRK-01
- [ ] `apps/worker/tests/test_reconnection.py` — stubs for WRK-02
- [ ] `apps/worker/tests/test_logging.py` — stubs for WRK-03
- [ ] `apps/worker/tests/test_error_classification.py` — stubs for WRK-04, WRK-06
- [ ] `apps/worker/tests/test_progress.py` — stubs for WRK-05
- [ ] `pytest` — install if not in requirements.txt

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SIGTERM during active translation | WRK-01 | Requires Docker signal + running LLM call | `docker compose kill -s SIGTERM prism-worker` during translation, check DB status = INTERRUPTED |
| Redis disconnect recovery | WRK-02 | Requires infrastructure manipulation | Stop Redis container, wait 10s, restart, verify worker resumes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

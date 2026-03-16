---
phase: 3
slug: frontend-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd apps/web && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm run build`
- **After every plan wave:** Run `cd apps/web && npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TUX-01 | smoke (build) | `cd apps/web && npm run build` | N/A | ⬜ pending |
| 03-01-02 | 01 | 1 | TUX-02 | unit | `npx vitest run src/components/ui/progress-bar.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | TUX-03 | unit | `npx vitest run src/lib/errorMessages.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | FE-01 | manual-only | Visual inspection | N/A | ⬜ pending |
| 03-01-05 | 01 | 1 | FE-02 | unit | `npx vitest run src/components/ErrorBoundary.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | FE-03 | smoke (build) | `cd apps/web && npm run build` | N/A | ⬜ pending |
| 03-01-07 | 01 | 1 | FE-04 | unit | `npx vitest run src/components/ui/progress-bar.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-08 | 01 | 1 | FE-05 | unit | `npx vitest run src/lib/mutations.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom` — test framework install
- [ ] `src/components/ui/progress-bar.test.tsx` — stubs for TUX-02, FE-04
- [ ] `src/lib/errorMessages.test.ts` — stubs for TUX-03
- [ ] `src/components/ErrorBoundary.test.tsx` — stubs for FE-02
- [ ] `src/lib/mutations.test.ts` — stubs for FE-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Layout polish: spacing, alignment, visual consistency | FE-01 | Visual/aesthetic quality cannot be automated | Inspect all 4 pages (Home, Library, Reader, Settings) for consistent spacing, alignment, and visual polish in both light and dark modes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

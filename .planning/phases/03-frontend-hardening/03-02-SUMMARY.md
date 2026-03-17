---
phase: 03-frontend-hardening
plan: 02
subsystem: ui
tags: [react-query, tanstack, error-boundary, progress-bar, badge, skeleton, theme, cva]

# Dependency graph
requires:
  - phase: 01-gateway-foundation
    provides: REST API endpoints for documents, llm-keys, models
provides:
  - React Query infrastructure (QueryClientProvider, query key factory)
  - Query functions for documents, llm-keys, models
  - Mutation hooks with optimistic updates (delete, retry, upload, save/remove key)
  - Error message mapping for LLM and pipeline errors
  - ErrorBoundary + ErrorFallback recovery UI
  - ProgressBar with determinate/indeterminate modes
  - Badge component with 5 status variants
  - Skeleton loading primitive
  - useTheme hook with light/dark/system persistence
affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-query"]
  patterns: ["query key factory", "optimistic mutation updates", "CVA + cn component pattern"]

key-files:
  created:
    - apps/web/src/lib/queries.ts
    - apps/web/src/lib/mutations.ts
    - apps/web/src/lib/errorMessages.ts
    - apps/web/src/components/ErrorBoundary.tsx
    - apps/web/src/components/ErrorFallback.tsx
    - apps/web/src/components/ui/progress-bar.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/ui/skeleton.tsx
    - apps/web/src/hooks/useTheme.ts
  modified:
    - apps/web/package.json
    - apps/web/src/main.tsx

key-decisions:
  - "React Query staleTime 2s, gcTime 5min, retry 1 as sensible defaults"
  - "Polling at 3s interval for non-final document states"
  - "Optimistic delete with rollback on error for instant UI feedback"

patterns-established:
  - "Query key factory: queryKeys.domain.scope() pattern for cache invalidation"
  - "Mutation hooks return useMutation with queryClient invalidation"
  - "CVA + cn for all new UI components (Badge, Skeleton)"
  - "ProgressBar uses framer-motion spring for determinate, animate-pulse for indeterminate"

requirements-completed: [FE-02, FE-03, FE-04, TUX-03]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 03 Plan 02: Shared Infrastructure & Components Summary

**React Query with query/mutation hooks, ErrorBoundary, ProgressBar, Badge, Skeleton, and theme hook -- shared foundation for page refactors**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T00:01:23Z
- **Completed:** 2026-03-17T00:03:15Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Installed React Query and wrapped app in QueryClientProvider with sensible defaults
- Created query key factory and fetch/mutation functions covering all server state (documents, llm-keys, models)
- Built all shared UI primitives: ErrorBoundary, ProgressBar (spring + pulse), Badge (5 variants), Skeleton
- Added useTheme hook with light/dark/system localStorage persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Install React Query and create query/mutation/error infrastructure** - `10d3fec` (feat)
2. **Task 2: Create shared UI components** - `23bd5dc` (feat)

## Files Created/Modified
- `apps/web/src/lib/queries.ts` - Query key factory, fetch functions, types, polling helper
- `apps/web/src/lib/mutations.ts` - Mutation hooks with optimistic updates for all write operations
- `apps/web/src/lib/errorMessages.ts` - Error code to user-friendly message mapping
- `apps/web/src/main.tsx` - QueryClientProvider wrapping App
- `apps/web/src/components/ErrorBoundary.tsx` - React error boundary class component
- `apps/web/src/components/ErrorFallback.tsx` - Recovery UI with reload button
- `apps/web/src/components/ui/progress-bar.tsx` - Animated progress with determinate/indeterminate modes
- `apps/web/src/components/ui/badge.tsx` - CVA badge with success/error/warning/info/accent variants
- `apps/web/src/components/ui/skeleton.tsx` - Loading skeleton primitive
- `apps/web/src/hooks/useTheme.ts` - Theme management with system preference detection

## Decisions Made
- React Query staleTime 2s, gcTime 5min, retry 1 as sensible defaults for this app's polling pattern
- 3-second polling interval for documents with non-final status
- Optimistic delete with rollback for instant UI feedback on document removal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared infrastructure ready for Plans 03 and 04 page refactors
- Query/mutation functions can be imported directly into page components
- UI primitives (Badge, ProgressBar, Skeleton) ready for DocumentCard and other components

## Self-Check: PASSED

All 10 created files verified present. Both task commits (10d3fec, 23bd5dc) verified in git log.

---
*Phase: 03-frontend-hardening*
*Completed: 2026-03-17*

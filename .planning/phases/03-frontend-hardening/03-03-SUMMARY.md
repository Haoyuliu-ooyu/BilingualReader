---
phase: 03-frontend-hardening
plan: 03
subsystem: ui
tags: [react-query, drag-and-drop, error-boundary, progress-bar, optimistic-update]

requires:
  - phase: 03-01
    provides: gateway progress/retry API endpoints
  - phase: 03-02
    provides: React Query setup, query/mutation hooks, UI primitives (ProgressBar, Badge, Skeleton, ErrorBoundary)
provides:
  - DocumentCard component with progress, error, retry UI
  - DropZone drag-and-drop upload component
  - Home and Library pages refactored to React Query with conditional polling
  - Error boundaries on all page routes
  - Semantic color tokens replacing hardcoded slate colors
affects: [03-frontend-hardening, 04-production-readiness]

tech-stack:
  added: []
  patterns: [DocumentCard pattern for status-based rendering, DropZone HTML5 drag-and-drop]

key-files:
  created:
    - apps/web/src/components/DocumentCard.tsx
    - apps/web/src/components/DropZone.tsx
  modified:
    - apps/web/src/pages/Home.tsx
    - apps/web/src/pages/Library.tsx
    - apps/web/src/components/FileUpload.tsx
    - apps/web/src/App.tsx
    - apps/web/src/store/useReaderStore.ts

key-decisions:
  - "DocumentCard renders error banner inline with retry/details toggle, not as toast"
  - "Library page keeps PDF thumbnail layout with DocumentCard nested below thumbnail"
  - "FileUpload uses React Query for saved keys instead of Zustand fetchSavedKeys"

patterns-established:
  - "DocumentCard: status-based rendering (completed/processing/failed) with Badge/ProgressBar/error banner"
  - "DropZone: HTML5 native drag-and-drop with hidden file input fallback"

requirements-completed: [TUX-01, TUX-02, FE-04, FE-05, FE-01]

duration: 4min
completed: 2026-03-17
---

# Phase 3 Plan 3: Document UX & React Query Migration Summary

**DocumentCard with progress/error/retry UI, DropZone drag-and-drop upload, React Query migration for Home/Library/FileUpload, and error boundaries on all routes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T04:03:10Z
- **Completed:** 2026-03-17T04:07:13Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- DocumentCard component renders status badges, progress bars, error banners with retry/details for all document states
- DropZone replaces plain file input with drag-and-drop and click-to-browse
- Home and Library pages use React Query with 3-second conditional polling (stops when all documents are in final state)
- FileUpload uses useUploadDocument mutation and React Query for saved keys
- All page routes wrapped in ErrorBoundary
- Hardcoded slate colors replaced with semantic tokens (bg-background, text-foreground, border-border)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DocumentCard and DropZone components** - `4bbf31f` (feat)
2. **Task 2: Refactor Home, Library, FileUpload, and App** - `4718d25` (feat)

## Files Created/Modified
- `apps/web/src/components/DocumentCard.tsx` - Reusable document card with progress, error, retry UI
- `apps/web/src/components/DropZone.tsx` - Drag-and-drop file upload zone
- `apps/web/src/pages/Home.tsx` - React Query, DocumentCard, skeletons, empty/error states
- `apps/web/src/pages/Library.tsx` - React Query, DocumentCard with PDF thumbnails
- `apps/web/src/components/FileUpload.tsx` - DropZone integration, useUploadDocument mutation
- `apps/web/src/App.tsx` - ErrorBoundary wrapping all page routes, semantic bg-background
- `apps/web/src/store/useReaderStore.ts` - Fixed Block.translated_text type to optional

## Decisions Made
- DocumentCard renders error banner inline with retry/details toggle, not as toast notification
- Library page keeps PDF thumbnail layout with DocumentCard nested below the thumbnail area
- FileUpload uses React Query for saved keys query instead of Zustand fetchSavedKeys effect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Block.translated_text type mismatch**
- **Found during:** Task 2 (build verification)
- **Issue:** queries.ts defines `translated_text?: string` (optional) but useReaderStore.ts had `translated_text: string` (required), causing TypeScript error when Reader.tsx imports from queries.ts
- **Fix:** Made `translated_text` optional in useReaderStore Block interface
- **Files modified:** apps/web/src/store/useReaderStore.ts
- **Verification:** npm run build passes
- **Committed in:** 4718d25 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type fix necessary for build to pass. No scope creep.

## Issues Encountered
- App.tsx had been modified by a concurrent plan (03-04 dark mode/mobile sidebar) and needed re-reading before write

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core UX components complete, ready for Plan 04 (dark mode, mobile sidebar)
- All pages use React Query for data fetching
- Error boundaries protect against runtime crashes

---
*Phase: 03-frontend-hardening*
*Completed: 2026-03-17*

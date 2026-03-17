---
phase: 03-frontend-hardening
plan: 04
subsystem: ui
tags: [dark-mode, react-query, zustand, tailwind, framer-motion, accessibility]

requires:
  - phase: 03-02
    provides: React Query infrastructure, query keys, mutations, useTheme hook
provides:
  - Dark mode CSS with .dark class selector and @custom-variant
  - ThemeToggle component cycling light/dark/system
  - Mobile-responsive sidebar with drawer and desktop collapse
  - Reader page on React Query with partial results banner
  - Settings page on React Query with empty state
  - Zustand useSettingsStore cleaned to client-only state
affects: [04-devops-deploy]

tech-stack:
  added: []
  patterns: [class-based dark mode via .dark selector, mobile drawer with framer-motion AnimatePresence, semantic color tokens]

key-files:
  created:
    - apps/web/src/components/ThemeToggle.tsx
  modified:
    - apps/web/src/globals.css
    - apps/web/src/components/Sidebar.tsx
    - apps/web/src/App.tsx
    - apps/web/src/pages/Reader.tsx
    - apps/web/src/pages/Settings.tsx
    - apps/web/src/store/useSettingsStore.ts

key-decisions:
  - "ThemeToggle cycles light->dark->system (3-state toggle, not 2-state)"
  - "Mobile sidebar uses framer-motion spring animation (damping 25, stiffness 300)"
  - "Reader PDF query uses staleTime Infinity and gcTime 0 for blob URL lifecycle"
  - "useSettingsStore stripped to draftKeys only; savedKeys fully managed by React Query"

patterns-established:
  - "Dark mode: @custom-variant dark + .dark class selector (not just media query)"
  - "Mobile navigation: framer-motion AnimatePresence drawer with backdrop"
  - "Semantic tokens: border-border, bg-card, bg-muted/30 (no hardcoded slate colors)"

requirements-completed: [FE-01, FE-02, FE-03]

duration: 4min
completed: 2026-03-17
---

# Phase 3 Plan 4: Dark Mode, Mobile Sidebar, and React Query Migration Summary

**Dark mode with .dark class toggle, mobile sidebar drawer, Reader/Settings on React Query, Zustand cleaned to client-only state**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T04:03:14Z
- **Completed:** 2026-03-17T04:07:19Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Dark mode CSS with .dark class selector and @custom-variant for Tailwind v4 compatibility
- ThemeToggle component with Sun/Moon icons cycling light/dark/system
- Mobile sidebar drawer with framer-motion slide-in animation and backdrop click-to-close
- Reader page migrated to React Query with loading skeleton, error retry, and partial results banner
- Settings page migrated to React Query with loading skeleton and empty state
- Zustand useSettingsStore stripped to client-only state (draftKeys only)
- All hardcoded slate colors replaced with semantic tokens throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Dark mode CSS migration, ThemeToggle component, and Sidebar enhancement** - `558619b` (feat)
2. **Task 2: Migrate Reader and Settings to React Query, clean up Zustand server state** - `0dd9d26` (feat)

## Files Created/Modified
- `apps/web/src/globals.css` - Added @custom-variant dark and .dark class selector block
- `apps/web/src/components/ThemeToggle.tsx` - New theme toggle component with accessibility labels
- `apps/web/src/components/Sidebar.tsx` - Mobile drawer, desktop collapse, ThemeToggle integration, semantic colors
- `apps/web/src/App.tsx` - Mobile menu state management, semantic color tokens
- `apps/web/src/pages/Reader.tsx` - React Query for document tree/PDF, partial results banner, loading/error states
- `apps/web/src/pages/Settings.tsx` - React Query for saved keys, empty state with Key icon, loading skeleton
- `apps/web/src/store/useSettingsStore.ts` - Stripped to client-only state (draftKeys, setDraftKey, clearDraft)

## Decisions Made
- ThemeToggle cycles light->dark->system (3-state toggle, not 2-state)
- Mobile sidebar uses framer-motion spring animation (damping 25, stiffness 300) for smooth feel
- Reader PDF query uses staleTime Infinity and gcTime 0 for blob URL lifecycle management
- useSettingsStore stripped to draftKeys only; savedKeys fully managed by React Query

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All frontend hardening complete: error boundaries, React Query, dark mode, mobile sidebar
- Ready for Phase 4 (DevOps/Deploy)
- All pages use semantic color tokens for consistent theming

---
*Phase: 03-frontend-hardening*
*Completed: 2026-03-17*

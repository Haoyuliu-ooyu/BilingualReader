# Phase 3: Frontend Hardening - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the React frontend with real-time translation progress, actionable error messages, retry capability, React Query for server state, and visual refinement across all pages. No new features — hardening and UX improvement of the existing SPA.

</domain>

<decisions>
## Implementation Decisions

### Progress display
- Horizontal progress bar with percentage text and segment counts (e.g., "45/120 segments — 37%") replaces the current spinner on document cards
- Show pipeline phase labels above the bar: Extracting → Generating Context → Translating
- Animated indeterminate bar during non-translation phases (extracting, context generation) — no fake percentage
- Progress bar fills with real segment count only during translation phase
- Progress visible on document cards in Home and Library pages only — no separate status page

### Error & retry UX
- Failed documents show inline error banner on the card: red background, mapped error message (e.g., "Invalid API key for OpenAI"), Retry + Details buttons
- Retry button resubmits with the original provider/model/language settings — one-click, no picker
- Per-page error boundaries: wrap each page (Home, Library, Reader, Settings) in an error boundary with "Something went wrong" + Reload button
- Partial results (content policy blocked segments): open Reader with available translations, show banner at top noting X blocked segments, blocked segments show placeholder text in translation panel

### React Query migration
- React Query for all server state (documents list, document detail, models, saved keys). Zustand stays for client-only state (auth token, reader page position, UI preferences)
- Polling: 3-second refetchInterval for documents in processing states, stops when all documents reach final state
- Optimistic update for document delete — instant UI removal, rollback on server error
- Replace useDocumentPolling hook with React Query's built-in refetchInterval
- Build query functions on top of existing apiFetch wrapper

### Layout polish
- Refine existing slate/minimal aesthetic — fix spacing, alignment, hover state inconsistencies. Add tasteful motion where it helps (progress bar animation, card hover lifts, subtle page transitions via framer-motion)
- All four pages (Home, Library, Reader, Settings) get layout attention
- Network errors shown inline where content would appear: "Couldn't load documents. [Retry]" — no toasts or global banners
- Empty states use lucide-react icon + short message + CTA link — no illustrations

### Upload UX
- Drag-and-drop zone replaces plain file input — supports both drag-and-drop and click-to-browse with visual feedback (border highlight, icon change on drag over)
- Upload progress: spinner only (existing "Uploading..." state) — no file upload progress bar. Translation progress is what matters

### Dark mode
- Full dark mode support with theme toggle (light/dark/system) in sidebar or settings
- Audit all pages and components for consistent dark: class coverage
- Ensure status badges, cards, inputs, and backgrounds all have proper dark variants

### Sidebar & navigation
- Collapsible sidebar with nav links (Home, Library, Settings) — collapses to icons only
- Persistent on desktop, drawer/overlay on mobile
- Standard SaaS navigation pattern

### Loading skeletons
- Consistent skeleton loading patterns across all pages
- Home: card skeletons matching document grid layout
- Library: keep existing skeleton grid (already good)
- Reader: split-pane skeleton matching PDF + translation layout
- Settings: form field skeletons

### Color palette
- Refine current slate base palette — tighten accent color usage
- Primary blue for CTAs, green/red/yellow for status badges
- Ensure consistent opacity and shade usage across light and dark modes

### Claude's Discretion
- React Query staleTime and cacheTime configuration
- Exact framer-motion transition parameters
- Skeleton component implementation (shared vs per-page)
- Error boundary fallback UI design details
- Dark mode toggle component placement and design
- Sidebar collapse breakpoint and animation
- Drag-and-drop implementation approach (native HTML5 vs library)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TUX-01 through TUX-03, FE-01 through FE-05 requirement definitions

### Phase dependencies
- `.planning/phases/02-worker-resilience/02-CONTEXT.md` — Error code format, progress data shape, pipeline phases that frontend consumes
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 checkpoints that must be TRUE)

### Existing frontend code
- `apps/web/src/lib/api.ts` — apiFetch wrapper (foundation for React Query functions)
- `apps/web/src/hooks/useDocumentPolling.ts` — Current polling implementation (to be replaced)
- `apps/web/src/store/` — Zustand stores (auth, reader, settings) — client state stays here
- `apps/web/src/components/ui/` — Existing shadcn-style Button + Card components
- `apps/web/src/components/Sidebar.tsx` — Existing sidebar component to enhance

### Project context
- `.planning/PROJECT.md` — Constraints (preserve React architecture, Tailwind CSS)
- `.planning/codebase/CONVENTIONS.md` — Frontend conventions and patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apiFetch` / `apiFetchJSON` (`lib/api.ts`): Auth-aware fetch wrapper — build React Query functions on top
- `Button` + `Card` (`components/ui/`): shadcn-style components — extend for new states
- `Sidebar.tsx`: Navigation component — enhance with collapse behavior
- `PDFThumbnail.tsx`: Library thumbnail renderer — keep as-is
- `framer-motion`: Already installed but barely used — leverage for transitions
- `lucide-react`: Icon library already in use — use for empty states and status icons

### Established Patterns
- Zustand for client state with `getState()` access pattern
- Tailwind CSS v4 with slate color palette and shadcn design tokens
- `useCallback` + `useEffect` for data fetching (to be replaced by React Query)
- Status badge pattern: colored pill with uppercase text (reuse across progress states)

### Integration Points
- Document status field: currently checks COMPLETED/FAILED — needs to handle new statuses (INTERRUPTED, extracting, generating_context, translating) and progress fields
- `DocumentMeta` interface: needs progress fields (translated_count, total_count, pipeline_phase, error_code, error_message)
- React Router: page-level error boundaries wrap route components
- `package.json`: needs @tanstack/react-query added as dependency

</code_context>

<specifics>
## Specific Ideas

- "Refine existing style, add a small portion of tasteful motion" — not a full motion design overhaul, just polish
- Progress bar should feel informative, not anxious — calm animation during indeterminate phases
- Error messages should be actionable, not technical — map error codes to user-friendly strings

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-frontend-hardening*
*Context gathered: 2026-03-16*

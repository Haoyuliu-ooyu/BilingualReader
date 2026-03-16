# Phase 3: Frontend Hardening - Research

**Researched:** 2026-03-16
**Domain:** React frontend -- server state management, progress UI, error handling, layout polish
**Confidence:** HIGH

## Summary

Phase 3 transforms the existing React SPA from a functional prototype into a polished application. The work spans six domains: (1) migrating server state from manual fetch+Zustand to React Query with automatic polling, (2) displaying real-time translation progress using data already written to the DB by the Phase 2 worker, (3) surfacing actionable error messages with retry capability, (4) adding error boundaries for crash resilience, (5) implementing dark mode with theme toggle, and (6) layout polish across all four pages.

The primary backend gap is that the gateway API does not yet expose the progress/error fields (`pipeline_phase`, `translated_count`, `total_count`, `error_detail`) that Phase 2's worker now writes to the `documents` table. The `DocumentMeta` struct and `ListByUser` SQL query must be extended. Additionally, no retry endpoint exists -- the gateway needs a `POST /api/documents/:id/retry` route that re-queues the existing document's job without re-uploading the PDF.

**Primary recommendation:** Start with gateway API extensions (progress fields + retry endpoint), then React Query migration, then progress/error UI, then layout polish and dark mode.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal progress bar with percentage text and segment counts (e.g., "45/120 segments -- 37%") replaces the current spinner on document cards
- Show pipeline phase labels above the bar: Extracting -> Generating Context -> Translating
- Animated indeterminate bar during non-translation phases (extracting, context generation) -- no fake percentage
- Progress bar fills with real segment count only during translation phase
- Progress visible on document cards in Home and Library pages only -- no separate status page
- Failed documents show inline error banner on the card: red background, mapped error message, Retry + Details buttons
- Retry button resubmits with the original provider/model/language settings -- one-click, no picker
- Per-page error boundaries: wrap each page (Home, Library, Reader, Settings) with "Something went wrong" + Reload button
- Partial results: open Reader with available translations, show banner noting X blocked segments
- React Query for all server state. Zustand stays for client-only state (auth token, reader page position, UI preferences)
- Polling: 3-second refetchInterval for documents in processing states, stops when all documents reach final state
- Optimistic update for document delete -- instant UI removal, rollback on server error
- Replace useDocumentPolling hook with React Query's built-in refetchInterval
- Build query functions on top of existing apiFetch wrapper
- Drag-and-drop zone replaces plain file input
- Full dark mode support with theme toggle (light/dark/system)
- Collapsible sidebar with nav links -- persistent on desktop, drawer/overlay on mobile
- Consistent skeleton loading patterns across all pages
- Refine slate base palette -- tighten accent color usage

### Claude's Discretion
- React Query staleTime and cacheTime configuration
- Exact framer-motion transition parameters
- Skeleton component implementation (shared vs per-page)
- Error boundary fallback UI design details
- Dark mode toggle component placement and design
- Sidebar collapse breakpoint and animation
- Drag-and-drop implementation approach (native HTML5 vs library)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TUX-01 | User can retry a failed translation from the frontend without re-uploading | Gateway needs retry endpoint; frontend needs retry mutation via React Query |
| TUX-02 | User sees granular translation progress (segment count or percentage) during processing | Gateway must expose progress fields; React Query polling at 3s interval |
| TUX-03 | User sees specific error reason when translation fails | Gateway must expose error_detail JSONB; frontend maps error codes to messages |
| FE-01 | Frontend layout is polished with proper spacing, alignment, and visual refinement | Tailwind + framer-motion for polish; dark mode; sidebar enhancement |
| FE-02 | Frontend has error boundaries with informative error states | React error boundary component wrapping each page route |
| FE-03 | Frontend uses React Query for server state management, replacing manual polling | @tanstack/react-query replaces useDocumentPolling + manual fetch patterns |
| FE-04 | Frontend displays translation progress from worker | Progress bar component consuming pipeline_phase + translated_count/total_count |
| FE-05 | Frontend provides retry button for failed documents | Retry mutation calling POST /api/documents/:id/retry |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.90 | Server state management, polling, caching, mutations | Industry standard for React server state; replaces manual fetch+state patterns |
| framer-motion | ^12.34 (already installed) | Progress bar animation, page transitions, card hover effects | Already in project; React-native animation library with declarative API |
| lucide-react | ^0.564 (already installed) | Icons for empty states, status indicators, navigation | Already in project |
| react-router-dom | ^7.6 (already installed) | Routing, error boundary integration | Already in project |
| zustand | ^5.0 (already installed) | Client-only state (auth, reader position, theme preference) | Already in project; stays for non-server state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | (already installed) | Conditional class composition | All component styling |
| class-variance-authority | (already installed) | Component variant definitions | Button, Badge, Card variants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 drag-and-drop | react-dropzone | react-dropzone adds dependency; native HTML5 DnD is sufficient for single-file PDF upload with dragover/dragleave/drop events. Use native. |
| Per-page skeletons | react-loading-skeleton | External lib unnecessary; Tailwind `animate-pulse` with div placeholders already used in Library page. Extend existing pattern. |
| next-themes | Manual dark mode toggle | next-themes is Next.js-specific. Manual class-based toggle with localStorage persistence is straightforward for Vite+React. |

**Installation:**
```bash
cd apps/web && npm install @tanstack/react-query
```

No other new dependencies needed. All other libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    api.ts              # Existing apiFetch wrapper (keep)
    queries.ts           # NEW: React Query key factories + query functions
    mutations.ts         # NEW: React Query mutation functions
    errorMessages.ts     # NEW: Error code -> user-friendly message map
  hooks/
    useDocumentPolling.ts  # DELETE after migration
    useModels.ts           # MIGRATE to React Query
    useTheme.ts            # NEW: dark mode toggle hook
  components/
    ui/
      button.tsx         # Existing (keep)
      card.tsx           # Existing (keep)
      progress-bar.tsx   # NEW: Animated progress bar
      badge.tsx          # NEW: Status badge component (extract from inline)
      skeleton.tsx       # NEW: Shared skeleton primitives
    ErrorBoundary.tsx     # NEW: Reusable error boundary
    DocumentCard.tsx      # NEW: Extract from Home/Library (progress + error + retry)
    DropZone.tsx          # NEW: Drag-and-drop file upload
    ThemeToggle.tsx       # NEW: Light/dark/system toggle
    Sidebar.tsx           # ENHANCE: mobile drawer, dark mode toggle placement
  pages/
    Home.tsx             # REFACTOR: use React Query, DocumentCard
    Library.tsx          # REFACTOR: use React Query, DocumentCard
    Reader.tsx           # REFACTOR: use React Query, partial results banner
    Settings.tsx         # REFACTOR: use React Query for saved keys
  store/
    useAuthStore.ts      # Keep (client state)
    useReaderStore.ts    # Keep (client state)
    useSettingsStore.ts  # SLIM DOWN: remove server-fetch logic, keep client preferences
```

### Pattern 1: React Query Key Factory
**What:** Centralized query key definitions for type safety and cache invalidation
**When to use:** All query/mutation definitions
**Example:**
```typescript
// lib/queries.ts
export const queryKeys = {
  documents: {
    all: ['documents'] as const,
    list: () => [...queryKeys.documents.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.documents.all, 'detail', id] as const,
    tree: (id: string) => [...queryKeys.documents.all, 'tree', id] as const,
  },
  llmKeys: {
    all: ['llm-keys'] as const,
    list: () => [...llmKeys.all, 'list'] as const,
  },
  models: {
    byProvider: (provider: string) => ['models', provider] as const,
  },
} as const

// Query function built on existing apiFetch
export function fetchDocuments(): Promise<DocumentMeta[]> {
  return apiFetchJSON<DocumentMeta[]>('/api/documents')
}
```

### Pattern 2: Conditional Polling with React Query
**What:** Poll only when documents are in processing state, stop when all reach final state
**When to use:** Document list queries on Home and Library pages
**Example:**
```typescript
const FINAL_STATES = new Set(['COMPLETED', 'FAILED'])

function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: fetchDocuments,
    refetchInterval: (query) => {
      const docs = query.state.data
      if (!docs) return false
      const hasPending = docs.some(d => !FINAL_STATES.has(d.status))
      return hasPending ? 3000 : false
    },
    staleTime: 2000,
  })
}
```

### Pattern 3: Optimistic Delete with Rollback
**What:** Remove document from UI immediately, restore on server error
**When to use:** Document deletion
**Example:**
```typescript
function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetchJSON(`/api/documents/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.documents.list() })
      const previous = queryClient.getQueryData(queryKeys.documents.list())
      queryClient.setQueryData(queryKeys.documents.list(), (old: DocumentMeta[]) =>
        old?.filter(d => d.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(queryKeys.documents.list(), context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list() })
    },
  })
}
```

### Pattern 4: Error Boundary with Recovery
**What:** Class component that catches render errors and shows fallback UI
**When to use:** Wrap each page route in App.tsx
**Example:**
```typescript
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}
```

### Pattern 5: Dark Mode with Class Strategy
**What:** Toggle `dark` class on `<html>`, persist preference in localStorage, respect system preference
**When to use:** Theme toggle component and initialization
**Example:**
```typescript
type Theme = 'light' | 'dark' | 'system'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) || 'system'
  )

  useEffect(() => {
    const root = document.documentElement
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', isDark)
    localStorage.setItem('theme', theme)
  }, [theme])

  return { theme, setTheme }
}
```

### Anti-Patterns to Avoid
- **Mixing server state in Zustand:** Do NOT keep documents list or saved keys in Zustand stores after React Query migration. Zustand is only for auth, reader position, and UI preferences.
- **Polling without stop condition:** React Query's `refetchInterval` callback MUST check if any documents are still processing. Infinite polling wastes bandwidth and battery.
- **Fake progress percentages:** During extracting/generating_context phases, show indeterminate animation. Only show real percentage during translation phase where `translated_count`/`total_count` are meaningful.
- **Hard-coded error messages:** Map error codes to user-friendly strings in a central `errorMessages.ts` file. Never show raw error codes or stack traces to users.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server state caching + polling | Custom useEffect+setInterval | @tanstack/react-query | Handles cache invalidation, deduplication, background refetch, optimistic updates, retry logic |
| Animated progress bar | CSS keyframe from scratch | framer-motion `motion.div` with `animate={{ width }}` | Smooth spring-based animation, handles layout changes |
| Error boundary | try/catch in render | React `ErrorBoundary` class component | Only class components can catch render errors; React API requirement |
| Query deduplication | Custom request dedup logic | React Query automatic deduplication | Multiple components mounting same query = single network request |
| Stale-while-revalidate | Custom cache layer | React Query staleTime + gcTime | Battle-tested SWR pattern with automatic background refetch |

**Key insight:** React Query eliminates ~80% of the manual data-fetching code (useEffect, useState for loading/error, setInterval polling, manual cache). The existing `apiFetch` wrapper slots in perfectly as the query function.

## Common Pitfalls

### Pitfall 1: DocumentMeta Missing Progress Fields
**What goes wrong:** Frontend tries to render progress bar but API response has no `pipeline_phase`, `translated_count`, `total_count`, or `error_detail` fields.
**Why it happens:** The gateway's `DocumentMeta` struct and `ListByUser` SQL query were written before Phase 2 added these columns. They need to be extended.
**How to avoid:** Extend `DocumentMeta` struct and SQL query FIRST, before any frontend progress work.
**Warning signs:** Progress bar always shows 0% or undefined values.

### Pitfall 2: No Retry Endpoint
**What goes wrong:** Frontend retry button has no API to call. The gateway has no endpoint for re-queuing a failed document.
**Why it happens:** The upload flow creates a new document + S3 upload + job queue push. Retry needs a simpler path: reset status, clear error, re-queue with existing S3 file and settings.
**How to avoid:** Create `POST /api/documents/:id/retry` that reads the existing document row, fetches the user's encrypted key for the stored provider, resets status to PENDING, clears error_detail, and pushes a new job to Redis.
**Warning signs:** No route matches POST retry call.

### Pitfall 3: Dark Mode CSS Variable Conflicts
**What goes wrong:** Dark mode toggle works but some components have hardcoded `bg-slate-50`, `text-slate-800` etc. that ignore the CSS variable system.
**Why it happens:** Current code mixes direct Tailwind colors (e.g., `bg-slate-50/30`, `text-slate-800`) with CSS variable-based tokens (`bg-card`, `text-foreground`). The CSS variables have dark variants defined via `@media (prefers-color-scheme: dark)` but the direct colors don't respond to dark mode.
**How to avoid:** (1) Switch from `@media (prefers-color-scheme: dark)` to `.dark` class selector in globals.css. (2) Audit all pages and replace hardcoded slate colors with semantic tokens (bg-background, text-foreground, bg-card, etc.). (3) Only use direct colors for intentional accent/status badges.
**Warning signs:** Some elements remain light-colored when dark mode is active.

### Pitfall 4: React Query + Zustand Double State
**What goes wrong:** Documents list exists in both React Query cache AND Zustand store, causing stale data and confusing updates.
**Why it happens:** Incremental migration where old Zustand patterns weren't fully removed.
**How to avoid:** Clean migration: remove ALL server-fetching logic from Zustand stores. `useSettingsStore` should only keep `draftKeys` and client preferences. `fetchSavedKeys`, `saveKey`, `removeKey` become React Query queries/mutations.
**Warning signs:** Data updates in one place but not the other.

### Pitfall 5: Sidebar Dark Mode on Mobile
**What goes wrong:** Sidebar drawer on mobile doesn't have backdrop overlay, or overlay doesn't respond to dark mode.
**Why it happens:** Mobile drawer needs a separate backdrop element with click-to-close. Current sidebar has no mobile-specific behavior.
**How to avoid:** Use framer-motion `AnimatePresence` for sidebar slide-in on mobile. Add a semi-transparent backdrop that closes sidebar on click.
**Warning signs:** Sidebar overlaps content on mobile without visual separation.

### Pitfall 6: INTERRUPTED Status Not Handled
**What goes wrong:** Frontend only knows COMPLETED and FAILED as terminal states. INTERRUPTED documents keep polling forever.
**Why it happens:** Phase 2 added INTERRUPTED status for graceful shutdown re-queue. Frontend's FINAL_STATES set needs updating.
**How to avoid:** INTERRUPTED is NOT a final state (worker re-queues the job). Keep it in the "processing" category. But update status display to show "Resuming..." or similar.
**Warning signs:** INTERRUPTED documents show as stuck processing even after they resume.

## Code Examples

### Gateway: Extended DocumentMeta
```go
// repository/interfaces.go -- add progress fields
type DocumentMeta struct {
    ID              string          `json:"id"`
    OriginalName    string          `json:"original_name"`
    TargetLang      string          `json:"target_lang"`
    Status          string          `json:"status"`
    LLMProvider     string          `json:"llm_provider,omitempty"`
    LLMModel        string          `json:"llm_model,omitempty"`
    CreatedAt       string          `json:"created_at"`
    PipelinePhase   string          `json:"pipeline_phase,omitempty"`
    TranslatedCount int             `json:"translated_count"`
    TotalCount      int             `json:"total_count"`
    ErrorDetail     json.RawMessage `json:"error_detail,omitempty"`
}
```

### Gateway: Retry Handler
```go
// POST /api/documents/:id/retry
func (h *DocumentHandler) RetryDocument(c *gin.Context) {
    docID := c.Param("id")
    userID := c.GetString("userID")
    // 1. Verify ownership and FAILED status
    // 2. Look up encrypted key for doc's llm_provider
    // 3. Reset status to PENDING, clear error_detail, reset progress
    // 4. Push job to Redis queue
    // 5. Return 200
}
```

### Frontend: Error Code Mapping
```typescript
// lib/errorMessages.ts
const ERROR_MESSAGES: Record<string, string> = {
  LLM_AUTH_FAILED: 'Invalid API key. Check your key in Settings.',
  LLM_RATE_LIMITED: 'Rate limit exceeded. Wait a moment and retry.',
  PIPELINE_ERROR: 'Translation failed due to an internal error.',
}

export function getErrorMessage(errorDetail?: { code: string; message: string }): string {
  if (!errorDetail) return 'Translation failed.'
  return ERROR_MESSAGES[errorDetail.code] || errorDetail.message || 'Translation failed.'
}
```

### Frontend: Progress Bar Component
```typescript
// components/ui/progress-bar.tsx
interface ProgressBarProps {
  phase: string | null
  translatedCount: number
  totalCount: number
}

function ProgressBar({ phase, translatedCount, totalCount }: ProgressBarProps) {
  const isTranslating = phase === 'translating'
  const percentage = isTranslating && totalCount > 0
    ? Math.round((translatedCount / totalCount) * 100)
    : 0

  return (
    <div>
      <span className="text-xs text-muted-foreground">
        {phase === 'extracting' && 'Extracting...'}
        {phase === 'generating_context' && 'Generating Context...'}
        {isTranslating && `${translatedCount}/${totalCount} segments -- ${percentage}%`}
      </span>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        {isTranslating ? (
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        ) : (
          <div className="h-full bg-primary/50 rounded-full animate-pulse w-full" />
        )}
      </div>
    </div>
  )
}
```

### Frontend: QueryClientProvider Setup
```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,      // 2s stale time
      gcTime: 5 * 60 * 1000, // 5 min garbage collection
      retry: 1,              // 1 retry on failure
      refetchOnWindowFocus: true,
    },
  },
})

// Wrap <App /> in <QueryClientProvider client={queryClient}>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 (react-query) | TanStack Query v5 (@tanstack/react-query) | 2023-10 | New API: `gcTime` replaces `cacheTime`, `throwOnError` replaces `useErrorBoundary`, simplified `refetchInterval` callback |
| `useErrorBoundary` in React Query | `throwOnError` option | v5 | Name change only; same behavior |
| `cacheTime` in React Query | `gcTime` | v5 | Renamed for clarity |
| `prefers-color-scheme` only | Class-based dark mode toggle | Standard | Allows manual override beyond system preference |
| Tailwind v3 darkMode: 'class' | Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` | 2024 | Tailwind v4 uses CSS-based configuration for dark mode variant |

**Deprecated/outdated:**
- React Query v4 import path `react-query` -- use `@tanstack/react-query` v5
- `cacheTime` option -- renamed to `gcTime` in v5
- `useErrorBoundary` option -- renamed to `throwOnError` in v5

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (not yet configured) + React Testing Library |
| Config file | none -- see Wave 0 |
| Quick run command | `cd apps/web && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/web && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUX-01 | Retry button calls retry endpoint | smoke (build check) | `cd apps/web && npm run build` | N/A |
| TUX-02 | Progress bar renders segment counts | unit | `npx vitest run src/components/ui/progress-bar.test.tsx` | Wave 0 |
| TUX-03 | Error messages mapped from error codes | unit | `npx vitest run src/lib/errorMessages.test.ts` | Wave 0 |
| FE-01 | Layout polish | manual-only | Visual inspection | N/A |
| FE-02 | Error boundary catches and recovers | unit | `npx vitest run src/components/ErrorBoundary.test.tsx` | Wave 0 |
| FE-03 | React Query replaces manual polling | smoke (build check) | `cd apps/web && npm run build` | N/A |
| FE-04 | Progress display during translation | unit | `npx vitest run src/components/ui/progress-bar.test.tsx` | Wave 0 |
| FE-05 | Retry mutation triggers re-queue | unit | `npx vitest run src/lib/mutations.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web && npm run build` (type-check + bundle)
- **Per wave merge:** `cd apps/web && npm run build && npm run lint`
- **Phase gate:** Build + lint green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Vitest not yet configured -- `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom` + `vitest.config.ts`
- [ ] No test files exist for frontend components
- [ ] Note: Frontend tests are secondary to build+lint verification. Most requirements are best validated by successful build (type safety) and manual visual inspection.

## Open Questions

1. **Retry endpoint implementation details**
   - What we know: Gateway needs POST /api/documents/:id/retry. It must verify FAILED status, fetch encrypted key, reset status, push to Redis.
   - What's unclear: Should retry also clear existing partial translations (pages/segments/translations rows)? The worker's checkpoint logic skips already-translated segments, so keeping them is safe and faster.
   - Recommendation: Keep existing translations on retry. Worker checkpoint logic handles deduplication. Only reset `status`, `pipeline_phase`, `error_detail`, and progress counts.

2. **Tailwind v4 dark mode class configuration**
   - What we know: Current globals.css uses `@media (prefers-color-scheme: dark)` for CSS variable dark values. To support manual toggle, need class-based approach.
   - What's unclear: Tailwind v4's exact syntax for enabling class-based dark mode differs from v3.
   - Recommendation: In Tailwind v4, add `@custom-variant dark (&:where(.dark, .dark *));` to globals.css and duplicate the dark CSS variables under `.dark` selector instead of `@media`.

3. **INTERRUPTED status display**
   - What we know: Worker sets INTERRUPTED when shutdown mid-job, then re-queues. Job will resume automatically.
   - What's unclear: How quickly does the re-queued job start? Should the UI distinguish INTERRUPTED from normal processing?
   - Recommendation: Treat INTERRUPTED as a processing state. Show "Resuming..." as the phase label. Include in polling (not a final state).

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: gateway handlers, repository, migrations, worker error codes, frontend components
- `apps/gateway/migrations/002_worker_progress.up.sql` -- confirmed DB columns exist
- `apps/worker/main.py` lines 136-146 -- confirmed error codes: LLM_AUTH_FAILED, LLM_RATE_LIMITED, PIPELINE_ERROR
- `apps/worker/services/db.py` -- confirmed error_detail is `{"code": "...", "message": "..."}`
- npm registry: @tanstack/react-query@5.90.21, framer-motion@12.37.0

### Secondary (MEDIUM confidence)
- TanStack Query v5 API patterns (staleTime, gcTime, refetchInterval callback) -- based on v5 documentation knowledge
- Tailwind v4 dark mode custom variant syntax -- based on Tailwind v4 migration knowledge

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified against npm registry and project package.json
- Architecture: HIGH -- patterns derived from codebase analysis and React Query v5 standard practices
- Pitfalls: HIGH -- identified from direct code inspection (missing API fields, no retry endpoint, hardcoded colors)
- Gateway changes: HIGH -- confirmed by reading actual Go structs, SQL queries, and migration files

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable libraries, project-specific findings)

---
status: testing
phase: 03-frontend-hardening
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-03-17T12:00:00Z
updated: 2026-03-17T12:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running services. Run `docker compose build && docker compose up`. All three services (gateway, worker, web) boot without errors. Gateway responds at http://localhost:8080/api/health (or any basic endpoint). Frontend loads at http://localhost:3000.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running services. Run `docker compose build && docker compose up`. All three services boot without errors. Gateway responds on :8080, frontend loads on :3000.
result: [pending]

### 2. Document List Shows Progress Fields
expected: Upload a PDF and watch the document card. During processing, you should see pipeline phase labels (Extracting, Generating Context, Translating) and a progress bar. During translation phase, the bar fills with real segment counts (e.g., "45/120 segments — 37%"). Non-translation phases show an animated indeterminate bar.
result: [pending]

### 3. Failed Document Shows Error Banner
expected: Trigger a translation failure (e.g., use an invalid API key). The document card shows a red error banner with a mapped error message (e.g., "Invalid API key. Check your key in Settings.") and Retry + Details buttons.
result: [pending]

### 4. Retry Failed Translation
expected: Click Retry on a failed document card. The document resets to PENDING status and starts processing again without requiring a new file upload. One click, no picker.
result: [pending]

### 5. Drag-and-Drop Upload
expected: Drag a PDF file onto the upload zone on the Home page. The zone highlights on drag-over. Dropping the file starts the upload flow (provider/model/language selection). Clicking the zone also opens a file browser as fallback.
result: [pending]

### 6. Error Boundary Recovery
expected: If a page component crashes (e.g., bad data), instead of a white screen you see "Something went wrong" with a "Reload Page" button. Clicking reload recovers the page.
result: [pending]

### 7. Dark Mode Toggle
expected: Find the theme toggle in the sidebar. Clicking cycles through light → dark → system modes. In dark mode, all pages have dark backgrounds with proper contrast — no leftover light-colored elements. System mode follows your OS preference.
result: [pending]

### 8. Mobile Sidebar Drawer
expected: Resize browser below 768px (or use mobile device). The sidebar collapses. A hamburger/menu button appears. Tapping it slides in the sidebar as a drawer with a semi-transparent backdrop. Tapping the backdrop or a nav item closes the drawer.
result: [pending]

### 9. Reader with Partial Results Banner
expected: Open a document that has some but not all segments translated. The Reader displays available translations and shows a banner noting how many segments are still pending (e.g., "X segments not yet translated").
result: [pending]

### 10. Settings Page with React Query
expected: Open Settings. Saved API keys load with a loading skeleton first. Adding/removing keys updates immediately. If no keys are saved, an empty state with a Key icon and helpful text is shown.
result: [pending]

### 11. Skeleton Loading States
expected: On first load or refresh, Home and Library pages show skeleton placeholders (pulsing gray rectangles) before content loads, not a blank page or spinner.
result: [pending]

### 12. Optimistic Document Delete
expected: Delete a document from Home or Library. The card disappears immediately (no waiting for server response). If the server delete fails, the card reappears.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]

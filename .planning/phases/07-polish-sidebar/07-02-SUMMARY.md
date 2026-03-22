---
phase: 07-polish-sidebar
plan: "02"
subsystem: sidebar-resize
tags: [sidebar, resize, icon-only, tdd, pointer-capture, dnd-kit]
dependency_graph:
  requires: ["07-01"]
  provides: ["sidebar-resize-hook", "icon-only-mode"]
  affects: ["src/components/Sidebar.tsx", "src/App.tsx"]
tech_stack:
  added: []
  patterns:
    - "Pointer capture for drag resize (setPointerCapture/releasePointerCapture)"
    - "stopPropagation on pointerDown to prevent dnd-kit capture conflict"
    - "Snap threshold pattern: <80px -> icon-only (48px), >=80px -> clamp(120, w, 300)"
key_files:
  created:
    - src/hooks/useSidebarResize.ts
    - src/__tests__/sidebarResize.test.ts
  modified:
    - src/components/Sidebar.tsx
    - src/App.tsx
decisions:
  - "clampWidth threshold is 80px: below snaps to icon-only 48px, at/above clamps to 120-300px range"
  - "Pointer capture on handle element so dragging outside the element keeps working"
  - "onWidthChange fires resize_active_webview on every drag move for live feedback"
  - "onWidthCommit fires save_sidebar_width only on drag end to avoid excessive disk writes"
  - "icon-only mode shows all apps flattened (no group structure), favicons only with iOS-style badge"
  - "isDragging on container adds select-none + col-resize to prevent text selection during drag"
metrics:
  duration_seconds: 148
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 07 Plan 02: Sidebar Resize & Icon-Only Mode Summary

**One-liner:** Pointer-capture edge-drag resize with 80px snap threshold to 48px icon-only mode, persisted via Rust save_sidebar_width.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useSidebarResize hook with snap/clamp logic and tests | a3f672c, 43381fe | src/hooks/useSidebarResize.ts, src/__tests__/sidebarResize.test.ts |
| 2 | Wire resize handle and icon-only mode into Sidebar and App | e4e5ec4 | src/components/Sidebar.tsx, src/App.tsx |

## What Was Built

**useSidebarResize hook** (`src/hooks/useSidebarResize.ts`):
- Exported `clampWidth(raw)` pure function: `<80 → {width:48, iconOnly:true}`, `>=80 → {width: clamp(120,raw,300), iconOnly:false}`
- `useSidebarResize` hook with `onPointerDown/Move/Up` handlers using pointer capture
- `stopPropagation()` on pointerDown prevents dnd-kit from capturing the drag
- Callbacks: `onWidthChange` (live resize) and `onWidthCommit` (persist on release)

**Sidebar.tsx** — Icon-only mode + resize handle:
- New props: `iconOnly`, `sidebarWidth`, `resizeHandleProps`
- Dynamic `style={{ width: iconOnly ? 48 : sidebarWidth }}` on aside element
- Icon-only mode: flattened app list (no group headers), favicons only, compact iOS-style badge overlay (number or dot)
- Full mode: unchanged rendering — group headers, labels, bell icons, badge counts
- Absolute resize handle div on the right edge with hover line visual indicator
- Toggle chevron retained in full mode; hidden in icon-only

**App.tsx** — Hook integration:
- State for `sidebarWidth` and `iconOnly`, initialized from `config.sidebarWidth`
- `useSidebarResize` wired with `invoke("resize_active_webview", ...)` on change and `invoke("save_sidebar_width", ...)` on commit
- `isDragging` drives `select-none cursor-col-resize` on the container
- `motion.aside` gets `style={{ width }}` matching the current resize state

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` — clean
- `npm test` — 37/37 tests pass (7 new clampWidth tests + 30 pre-existing)
- Rust tests: not run (no Rust changes in this plan)

## Self-Check: PASSED

Files verified:
- src/hooks/useSidebarResize.ts — FOUND
- src/__tests__/sidebarResize.test.ts — FOUND
- src/components/Sidebar.tsx — FOUND (modified)
- src/App.tsx — FOUND (modified)

Commits verified:
- a3f672c — test(07-02): add failing tests for clampWidth snap/clamp logic
- 43381fe — feat(07-02): implement useSidebarResize hook with clampWidth and pointer capture
- e4e5ec4 — feat(07-02): wire sidebar resize handle, icon-only mode, and App integration

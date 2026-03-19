---
phase: 04-performance-activity
plan: "02"
subsystem: activity-badges
tags: [rust, tauri, ipc, react, sidebar, badges]
dependency_graph:
  requires: [04-01]
  provides: [activity-badge-infrastructure]
  affects: [src-tauri/src/commands/webview.rs, src-tauri/capabilities/default.json, src/hooks/useAppsConfig.ts, src/components/Sidebar.tsx, src/App.tsx]
tech_stack:
  added: []
  patterns: [MutationObserver-initialization-script, Rust-eval-CustomEvent-relay, React-Set-state-badge-tracking]
key_files:
  created: []
  modified:
    - src-tauri/src/commands/webview.rs
    - src-tauri/capabilities/default.json
    - src-tauri/src/lib.rs
    - src/hooks/useAppsConfig.ts
    - src/components/Sidebar.tsx
    - src/App.tsx
decisions:
  - "MutationObserver observes document.documentElement with subtree:true childList:true characterData:true — catches SPA title updates from Gmail, Linear, Slack that set document.title directly"
  - "try/catch around __TAURI_INTERNALS__.invoke — badge is best-effort; third-party CSP blocks are swallowed silently"
  - "Badge cleared in both handleAppSwitched (keyboard shortcut path) and switchApp (click path) — dual clear ensures no stale badge regardless of navigation method"
  - "hasBadge && !isActive guard in JSX — active app never shows a badge even if Rust fires event before state settles"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 6
---

# Phase 04 Plan 02: Activity Badge Dots Summary

**One-liner:** MutationObserver injected into child webviews via Tauri initialization_script, relaying title changes through Rust IPC to React badge state, rendering 6px white dot on background sidebar items.

## What Was Built

Activity badge infrastructure end-to-end:

1. **Rust IPC command `notify_title_changed`** — receives `appId` + `title` from child webview, checks if app is currently active (skips if yes), and relays to the main webview via `window.dispatchEvent(new CustomEvent('app-title-changed', { detail: { appId, title } }))`.

2. **MutationObserver injection via `initialization_script`** — added to `WebviewBuilder` chain in `switch_app_impl`. Observes `document.documentElement` with `subtree: true, childList: true, characterData: true` to catch SPA title changes. Calls `window.__TAURI_INTERNALS__.invoke('notify_title_changed', ...)` wrapped in try/catch.

3. **Capabilities extended** — `"windows": ["main", "app-*"]` grants IPC access to child webviews so the injected script can invoke Rust commands.

4. **React badge state in `useAppsConfig`** — `badgeAppIds: Set<string>` tracked via `useState`. Adds IDs on `app-title-changed` event. Clears on app switch (both `handleAppSwitched` event handler for keyboard path, and `switchApp` function for click path).

5. **Sidebar dot badge** — `hasBadge: boolean` prop on `SortableAppItemProps`. Renders `<span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white opacity-90" />` when `hasBadge && !isActive`. Wired through `App.tsx` via `badgeAppIds.has(app.id)`.

## Verification

- `cargo check` passed (2 pre-existing unused variable warnings, not caused by this plan)
- `npm run build` passed (TypeScript strict, no type errors)

## Decisions Made

- **MutationObserver scope:** `document.documentElement` with all subtree flags — this catches SPAs that update `document.title` programmatically (Angular, React, Vue all set it directly without DOM mutation on `<title>` element itself)
- **Best-effort badge:** `try/catch` around `__TAURI_INTERNALS__.invoke` — third-party CSP may block the invoke; failure is silent, badge simply won't appear for those apps
- **Dual clear path:** Badge cleared in both `handleAppSwitched` (Rust fires this via eval after switch_app_impl completes, covers keyboard shortcuts Cmd+1-9) and `switchApp` (runs before invoke, covers click). No stale badge regardless of path.
- **`app-*` glob capability:** Tauri capabilities support glob patterns in windows array — confirmed by Tauri v2 docs

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `src-tauri/src/commands/webview.rs` — notify_title_changed command + MutationObserver init_script
- [x] `src-tauri/capabilities/default.json` — windows includes "app-*"
- [x] `src-tauri/src/lib.rs` — notify_title_changed registered in invoke_handler
- [x] `src/hooks/useAppsConfig.ts` — badgeAppIds state + event listeners + badge clear
- [x] `src/components/Sidebar.tsx` — hasBadge prop + white dot badge JSX
- [x] `src/App.tsx` — badgeAppIds passed to Sidebar

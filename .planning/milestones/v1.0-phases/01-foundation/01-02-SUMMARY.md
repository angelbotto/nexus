---
phase: 01-foundation
plan: 02
subsystem: webview
tags: [tauri2, rust, react, typescript, webview, session-isolation, md5, routing]

requires:
  - 01-foundation-01 (AppState with webviews_created, config layer, IPC boundary)

provides:
  - routing.rs: extract_base_domain, is_subdomain_of, is_oauth_provider, make_store_id helpers
  - switch_app IPC command: lazy WebviewWindow creation with data_store_identifier session isolation
  - on_navigation + on_new_window closures blocking external URLs, opening via system browser
  - useAppsConfig React hook: loads config, tracks activeAppId, exposes switchApp
  - Sidebar component: flat app list with favicons, active state, click-to-switch
  - App.tsx updated: sidebar layout + useAppsConfig integration

affects:
  - 01-foundation-03 (builds on webview management; webviews_created is now populated)
  - all future plans using switch_app IPC

tech-stack:
  added:
    - tauri::webview::NewWindowResponse (Tauri 2 new window response)
    - tauri_plugin_opener::OpenerExt (system browser integration)
  patterns:
    - Lazy WebviewWindow creation: created on first click, tracked in AppState.webviews_created
    - data_store_identifier([u8; 16]) from md5::compute(app_id) for macOS session isolation
    - on_navigation returns bool; on_new_window returns NewWindowResponse (Allow/Deny)
    - External URLs opened via app_handle.opener().open_url() before blocking navigation
    - React hook pattern: useAppsConfig encapsulates IPC + local state
    - Google Favicon API for app icons: https://www.google.com/s2/favicons?domain={host}&sz=32

key-files:
  created:
    - src-tauri/src/routing.rs
    - src-tauri/src/commands/webview.rs
    - src/hooks/useAppsConfig.ts
    - src/components/Sidebar.tsx
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/App.tsx

key-decisions:
  - "extract_base_domain uses simple last-2-segments heuristic (covers 99% of Phase 1 cases)"
  - "on_navigation blocks external URLs and calls opener before returning false — opener must be called before blocking since returning false cancels the load"
  - "Sidebar uses fixed 220px width with Tailwind dark gray palette (bg-gray-900 / bg-gray-700 active)"
  - "useAppsConfig error handling: silent failure (no error state surfaced) — config load failure shows null config fallback in App.tsx"

requirements-completed: [WEB-01, WEB-05, WEB-06]

duration: 5min
completed: 2026-03-19
---

# Phase 1 Plan 2: WebviewWindow Management and Sidebar Summary

**Session-isolated WebviewWindows with md5-derived data_store_identifier, lazy creation on click, hide/show switching, navigation guards for external URLs, and a Tailwind sidebar with favicon icons**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T03:04:23Z
- **Completed:** 2026-03-19T03:09:13Z
- **Tasks:** 2 (Task 1: TDD with RED + GREEN; Task 2: UI)
- **Files created:** 4, modified: 3

## Accomplishments

- `routing.rs` with 13 unit tests all passing: domain extraction, subdomain check, OAuth detection, deterministic md5 store IDs
- `switch_app` IPC command: creates WebviewWindow on first click with `data_store_identifier(md5::compute(app_id).0)` for macOS session isolation; subsequent clicks show/hide
- Navigation guards: `on_navigation` allows same-domain + subdomains + OAuth providers, blocks external URLs (opens via system browser); `on_new_window` same logic
- Label collision guard: checks `webviews_created` before creating new window
- `useAppsConfig` hook encapsulates all IPC calls; `Sidebar` renders flat app list with Google Favicon API icons
- TypeScript compiles clean; full 21-test Rust suite passes

## Task Commits

1. **test(01-02): add failing tests for routing helpers** - `524e68b` (RED phase)
2. **feat(01-02): routing helpers and switch_app IPC command** - `b0b6069` (GREEN phase + webview command)
3. **feat(01-02): sidebar component and app switching UI** - `faf3d3b`

## Files Created

- `src-tauri/src/routing.rs` — Domain extraction, subdomain check, OAuth provider detection, md5 store ID generation, 13 unit tests
- `src-tauri/src/commands/webview.rs` — switch_app IPC command with lazy WebviewWindow creation, session isolation, navigation/new-window guards
- `src/hooks/useAppsConfig.ts` — React hook wrapping load_config + switch_app IPC, tracks activeAppId
- `src/components/Sidebar.tsx` — Flat app list with Google Favicon API icons, active state highlight, fixed 220px width

## Files Modified

- `src-tauri/src/commands/mod.rs` — Added `pub mod webview`
- `src-tauri/src/lib.rs` — Added `mod routing`, registered `switch_app` in `generate_handler!`
- `src/App.tsx` — Replaced inline config call with `useAppsConfig` hook, added `<Sidebar>` layout

## Decisions Made

- **extract_base_domain heuristic:** Taking the last 2 segments of the hostname (e.g., `google.com` from `mail.google.com`) covers all Phase 1 apps. A proper PSL library is deferred to Phase 3+ if needed.
- **External URL handling in on_navigation:** Must call `opener().open_url()` before returning `false` — once `false` is returned the navigation is cancelled and the closure context may not be re-entered.
- **Sidebar styling:** Minimal functional dark palette (`bg-gray-900` / `bg-gray-700` for active) — no polish per CONTEXT.md decisions for Phase 1.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- `switch_app` IPC command wired end-to-end — Plan 03 can build on top of this
- Session isolation is in place via `data_store_identifier` — logins will persist across restarts
- Navigation guards in `on_navigation` + `on_new_window` prevent webview pop-out — Plan 03 can refine the OAuth allow-list
- `AppState.webviews_created` is populated on first click — Plan 03 can check/enumerate running webviews

---
*Phase: 01-foundation*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: src-tauri/src/routing.rs
- FOUND: src-tauri/src/commands/webview.rs
- FOUND: src/hooks/useAppsConfig.ts
- FOUND: src/components/Sidebar.tsx
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- FOUND: commit 524e68b (test RED phase)
- FOUND: commit b0b6069 (feat routing + webview command)
- FOUND: commit faf3d3b (feat sidebar UI)

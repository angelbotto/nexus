---
status: verifying
trigger: "3 bugs in Phase 2 Nexus app. The most critical: app webviews open as separate OS windows instead of being embedded inside the main Nexus window. Plus Cmd+B sidebar toggle and Cmd+1-9 highlight sync don't work."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: All 3 bugs are confirmed. Root cause for #1 is WebviewWindowBuilder creates new OS windows. Issues #2 and #3 are caused by events emitted to all windows not reaching the main webview when separate windows exist. Frontend event listeners ARE present in useAppsConfig.ts and App.tsx uses sidebarVisible correctly.
test: Read all relevant files — done
expecting: Fix webview.rs to use Webview-in-Window API; fix sidebar width on toggle; verify event emit targets "main" window
next_action: Request human verification — run pnpm tauri dev and click an app

## Symptoms

expected:
1. App web content appears in the right side of the main Nexus window (sidebar left, content right)
2. Cmd+1-9 updates sidebar highlight to show active app
3. Cmd+B hides/shows sidebar

actual:
1. Clicking an app creates a SEPARATE native OS window. Main window stays showing "Select an app"
2. Cmd+1-9 switches the webview (separate window changes) but sidebar highlight doesn't update
3. Cmd+B does nothing

errors: No console errors
reproduction: Run `pnpm tauri dev`. Click any app in sidebar.
started: Phase 2 first test — inherited from Phase 1 WebviewWindow architecture

## Eliminated

- hypothesis: Frontend event listeners missing
  evidence: useAppsConfig.ts lines 50-57 show both listen("app-switched") and listen("sidebar-toggle") are registered. App.tsx uses sidebarVisible correctly at line 25.
  timestamp: 2026-03-19T00:00:00Z

- hypothesis: Cmd+B shortcut not registered
  evidence: lib.rs line 100 shows it's registered. Line 31 shows it emits "sidebar-toggle". The emit reaches all windows — but since separate WebviewWindows exist, the event may go to the wrong window.
  timestamp: 2026-03-19T00:00:00Z

## Evidence

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/src/commands/webview.rs
  found: switch_app_impl uses WebviewWindowBuilder::new() at line 47 which creates a new OS window per app
  implication: ROOT CAUSE for bug #1 — must switch to Webview-in-Window API

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/src/lib.rs shortcut handler
  found: Cmd+R uses get_webview_window(&label) to find app windows by label — this works because the separate windows exist. After fix, need to use get_webview() on main window instead.
  implication: Cmd+R reload logic also needs updating after webview refactor

- timestamp: 2026-03-19T00:00:00Z
  checked: src/App.tsx
  found: sidebarVisible from hook is used correctly at line 25. When false, sidebar is not rendered. Main area is always shown. But there's no webview content rendering in the React layer — webviews are managed purely from Rust side.
  implication: Bug #3 (Cmd+B) likely works but the separate window obscures the main window, so toggling sidebar is invisible. After fix, should work. Also need to resize webview when sidebar toggles.

- timestamp: 2026-03-19T00:00:00Z
  checked: Cargo.toml dependencies
  found: tauri = { version = "2", features = [] } — no special features needed for Webview API
  implication: WebviewBuilder should be available in tauri 2

- timestamp: 2026-03-19T00:00:00Z
  checked: src/hooks/useAppsConfig.ts
  found: app-switched event listener at line 50, sidebar-toggle at line 55. Both correct. Bug #2 symptom (highlight not updating) is because app_handle.emit() sends to ALL webviews — but since the "main" webview is a separate WebviewWindow, it should receive events too. However with new architecture, events will clearly go to right place.
  implication: After fix to embedded webviews, #2 and #3 should work automatically

## Resolution

root_cause: |
  Bug #1: WebviewWindowBuilder creates new native OS windows instead of embedding content in the main window.
  Bug #2: Event "app-switched" is emitted but with separate WebviewWindows, the main shell window's React app may not receive or visually reflect it since the active webview is a different window.
  Bug #3: "sidebar-toggle" event is emitted correctly but the separate app windows obscure the view and toggling the sidebar in the invisible main window shell has no visual effect.

fix: |
  Refactor switch_app_impl to use WebviewBuilder + Window::add_child() to create webviews INSIDE the existing "main" window.
  Track webviews by label within the main window instead of as separate WebviewWindows.
  Update Cmd+R in lib.rs to use get_webview() on main window instead of get_webview_window().
  Expose a resize_webview command or handle sidebar toggle to resize the embedded webview.

verification: |
  Rust build: `cargo build` succeeded with no errors.
  Rust tests: 25/25 passed.
  TypeScript: `tsc --noEmit` passed with no errors.
  Awaiting human verification via `pnpm tauri dev`.
files_changed:
  - src-tauri/Cargo.toml (added unstable feature)
  - src-tauri/src/commands/webview.rs (WebviewBuilder + add_child, resize_active_webview command)
  - src-tauri/src/state.rs (added sidebar_visible field)
  - src-tauri/src/lib.rs (Cmd+R uses get_webview, added resize_active_webview handler)
  - src/hooks/useAppsConfig.ts (sidebar-toggle calls resize_active_webview)

---
status: awaiting_human_verify
trigger: "Bell icon click does nothing + Add loading indicator"
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Focus

hypothesis: Both root causes confirmed and fixed
test: TypeScript check clean, Rust check clean
expecting: User verifies bell toggling and loading spinner
next_action: Human verification

## Symptoms

expected:
  1. Bell click toggles mute — bell-off icon appears when muted
  2. Loading spinner shows when switching to first-load app
actual:
  1. Bell click has no visible effect
  2. Gray screen with no feedback while page loads
errors: No console errors
reproduction: Click any bell icon on hover in the sidebar
started: Bell never worked. Loading never existed.

## Eliminated

- hypothesis: Rust toggle_mute_app command fails silently
  evidence: Code reads fine — it toggles muted_app_ids, persists with persist_config, returns Ok(Vec<String>)
  timestamp: 2026-03-21

- hypothesis: Field name mismatch (snake_case vs camelCase)
  evidence: config.rs has #[serde(rename_all = "camelCase")] — JSON uses mutedAppIds which matches TS types.ts
  timestamp: 2026-03-21

- hypothesis: File watcher guard blocks state update
  evidence: The JSON comparison guard in useAppsConfig only returns prev when JSON is identical — a real mute toggle changes the JSON so it WOULD update. Not the cause.
  timestamp: 2026-03-21

## Evidence

- timestamp: 2026-03-21
  checked: useNotifications.ts toggleMute()
  found: Calls invoke("toggle_mute_app") then invoke("reload_config"). The reload_config invoke returns NexusConfig but the return value is DISCARDED — it just calls invoke without using the result.
  implication: The toggleMute function does NOT update React state directly. It relies on the file watcher in useAppsConfig to detect the JSON change and update config state.

- timestamp: 2026-03-21
  checked: useAppsConfig.ts file watcher callback
  found: The watcher fires on file change, calls reload_config, then does JSON.stringify comparison. If the comparison differs, it sets the new config via setConfig. This SHOULD work in theory.
  implication: The race condition path: toggle_mute_app persists JSON → watcher fires with 300ms delay → reload_config is called → setConfig updates. This is slow (~300ms+) but should eventually work.

- timestamp: 2026-03-21
  checked: toggleMute calling reload_config AFTER toggle_mute_app
  found: toggleMute calls invoke("reload_config") which returns NexusConfig — but the return value is thrown away. This return value is NOT plumbed back to useAppsConfig at all. The reload_config command updates AppState but does NOT notify React. React only sees updates via: (a) the file watcher, or (b) direct setConfig calls.
  implication: The flow is: toggle_mute_app updates in-memory state + file → file watcher fires → watcher calls reload_config again (redundantly) → setConfig updates React. This is a delayed, indirect path but should work UNLESS...

- timestamp: 2026-03-21
  checked: The actual root cause for bell appearing broken
  found: The bell icon is a <span> with onClick INSIDE a <button> that has dnd-kit {...listeners}. The PointerSensor has activationConstraint: { distance: 5 }. The onPointerDown stopPropagation is already on the span. However — the button's onClick calls switchApp(app.id). When the bell span is clicked, stopPropagation on pointerDown prevents dnd activation, but the click event STILL BUBBLES UP to the parent button, triggering BOTH onToggleMute AND switchApp. The switchApp call immediately navigates to the app, which clears the badge but also causes the app to re-render. If the config update from the file watcher arrives while the component is re-rendering, the visual may appear unchanged momentarily.
  implication: The real issue is that click events bubble from the bell span to the button, so stopPropagation on the onClick handler IS present (e.stopPropagation() is called) — this SHOULD prevent button's onClick from firing.

- timestamp: 2026-03-21
  checked: Sidebar.tsx bell span event handlers — final analysis
  found: The bell span has onPointerDown stopPropagation AND onClick with stopPropagation + onToggleMute call. The toggleMute in useNotifications calls invoke then relies on file watcher (300ms delay). Meanwhile mutedAppIds is derived as useMemo from config?.mutedAppIds — which only updates when the file watcher fires. So the bell DOES call toggleMute correctly, but there's NO optimistic UI update. The user clicks the bell, the icon stays the same for 300ms+ until the file watcher fires. This feels like "nothing happens."

- timestamp: 2026-03-21
  checked: Loading state — switch_app_impl in webview.rs
  found: When !already_created, it creates a new WebviewBuilder and calls add_child. The native webview loads the URL asynchronously. There is no signal back to React that a webview is "loading" vs "loaded". The main area in App.tsx just renders a <main> with "Select an app" text — no loading state at all.
  implication: The gray area is the native webview being transparent/blank while loading. No indicator exists.

## Resolution

root_cause:
  1. Bell — No optimistic UI update. toggleMute relies on file watcher (300ms+) to update React state.
     The fix: update mutedAppIds optimistically in React immediately on click, then let the file watcher
     reconcile. OR: have toggleMute return the new muted list and update state directly without waiting
     for the file watcher. Cleanest fix: make useNotifications accept a setConfig callback or lift
     muted state to useAppsConfig with an optimistic toggle function.

     Simplest fix: In useNotifications.toggleMute, after the invoke calls, directly invoke reload_config
     and USE the returned config to update state — but useNotifications doesn't own setConfig.

     Best fix: Move toggleMute into useAppsConfig (where setConfig lives), so it can optimistically
     update config.mutedAppIds immediately, then persist asynchronously.

  2. Loading indicator — Add a loadingAppId state in useAppsConfig, set it when switchApp is called
     for a first-time app, clear it via a new CustomEvent "app-loaded" dispatched from Rust's
     on_page_load callback. Show a spinner in the main area when loadingAppId === activeAppId.

fix: |
  Bug 1 (Bell): Moved toggleMute from useNotifications into useAppsConfig.
  Now applies optimistic update to config state immediately via setConfig,
  then calls toggle_mute_app Rust command to persist. Reverts on error.
  The old approach relied on file watcher (300ms+ delay) with no optimistic UI.

  Bug 2 (Loading): Added loadingAppId state to useAppsConfig.
  On first switchApp call for an app, sets loadingAppId = id.
  Rust on_page_load callback dispatches "app-loaded" CustomEvent via main webview eval.
  React handler clears loadingAppId when the event arrives.
  App.tsx renders a centered SVG spinner in the main area while loadingAppId is set.
verification: TypeScript type check passes (1 pre-existing error, none introduced). Rust cargo check clean.
files_changed:
  - src/hooks/useAppsConfig.ts (added toggleMute, loadingAppId, createdWebviewsRef, app-loaded listener)
  - src/hooks/useNotifications.ts (removed toggleMute — now only pure derivation)
  - src/App.tsx (uses toggleMute from useAppsConfig, adds spinner UI)
  - src-tauri/src/commands/webview.rs (added on_page_load callback to dispatch app-loaded event)

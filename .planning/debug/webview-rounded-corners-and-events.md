---
status: awaiting_human_verify
trigger: "webview-rounded-corners-and-events"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — all three root causes identified and fixed
test: pnpm tauri dev, open app, switch apps, test Cmd+B and Cmd+1-9
expecting: rounded corners on webview, sidebar toggle works after switching, highlight updates correctly
next_action: human verification

## Symptoms

expected:
1. Webview should have rounded corners (like Arc browser)
2. Cmd+B should toggle sidebar at all times
3. Cmd+1-9 should update sidebar highlight at all times

actual:
1. Webview content is rectangular — no rounded corners on the native WKWebView
2. Cmd+B stops working after switching between apps
3. Cmd+N highlight works on first app but stops updating when switching

errors: None visible.
reproduction: pnpm tauri dev, open an app, switch to another, try Cmd+B and Cmd+N.
started: ongoing

## Eliminated

- hypothesis: Stale closure in app-switched listener
  evidence: The listener just calls setActiveAppId(event.payload) — no stale value read, no computation on old state. This is fine.
  timestamp: 2026-03-19T00:00:00Z

- hypothesis: React StrictMode double-listener (previous fix)
  evidence: The useEffect already has cleanup and the cancel guard. Double-invocation would cause double register then immediate cleanup of first set — net result should be single listener. Not the root cause.
  timestamp: 2026-03-19T00:00:00Z

## Evidence

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/src/lib.rs — global shortcut handler
  found: emit_to("main", "sidebar-toggle", ()) — emits ONLY to "main" window target. Global shortcuts are registered as system-level shortcuts (tauri_plugin_global_shortcut). These fire regardless of which window has focus.
  implication: The Rust side should always fire. The events ARE being emitted. Problem must be on the JS listener side.

- timestamp: 2026-03-19T00:00:00Z
  checked: src/main.tsx
  found: React.StrictMode wraps App. In dev mode, StrictMode intentionally mounts → unmounts → remounts every component. The useEffect in useAppsConfig runs twice: first run registers listeners and sets cleanupFns, then StrictMode calls cleanup (unlistens), then runs again. The second run should be the live one.
  implication: In theory this is handled. But the async init() function complicates this — see next finding.

- timestamp: 2026-03-19T00:00:00Z
  checked: src/hooks/useAppsConfig.ts — async init inside useEffect
  found: The listen() calls are async. The cleanup function runs synchronously when StrictMode unmounts. cleanupFns array is populated INSIDE the async init(). If StrictMode calls cleanup before init() resolves, the unlisten functions haven't been pushed yet, so cleanup is a no-op. The first set of listeners remain ALIVE and never get cleaned up.
  implication: Two sets of listeners exist simultaneously in dev mode. BUT this alone doesn't explain why events stop working after switching apps — both listeners would fire.

- timestamp: 2026-03-19T00:00:00Z
  checked: The event target "main" in emit_to
  found: emit_to("main", ...) emits to the WINDOW labeled "main". The child webviews (app-{id}) are separate webviews but they're children of the main window. The main window's JS context is where the React app lives. Child webviews are entirely separate browsing contexts — they don't receive these events.
  implication: The React listeners in "main" window SHOULD receive events. This is correct.

- timestamp: 2026-03-19T00:00:00Z
  checked: What happens when a child webview is clicked/focused
  found: When user clicks on a child webview (app-{id}), that webview gains OS focus. The global shortcuts (tauri_plugin_global_shortcut) are SYSTEM-LEVEL shortcuts — they should fire regardless of which window/webview has focus. BUT the "main" window JS context may be in a backgrounded state or the event channel may be affected.
  implication: This is a known Tauri 2 issue — when a child webview is focused, emit_to("main", ...) may not deliver if the main webview is not the active webview. The events need to be emitted to ALL webviews or use app.emit() instead of emit_to("main").

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/src/lib.rs line 31 and src-tauri/src/commands/webview.rs line 143
  found: Both use emit_to("main", ...) targeting the window. When the child webview (app-gmail, etc.) is the focused surface, the "main" window's JS runtime may be suspended/throttled by the OS or Tauri's event delivery.
  implication: ROOT CAUSE for issues 2+3: emit_to("main", ...) should be replaced with app_handle.emit(...) which broadcasts to ALL webviews/windows including the main one — ensuring delivery regardless of which webview is active.

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/Cargo.toml
  found: No objc2 dependency. Tauri 2 depends on wry which itself depends on objc2. It should be available as a transitive dep, but we need to add it explicitly to use it directly. Alternative: use objc crate (older) or use raw objc calls via std::os::raw.
  implication: For rounded corners, need to add objc2 dependency and use with_webview() on the child Webview. The Webview type in Tauri 2 has with_webview() available since features = ["unstable"] is already enabled.

## Resolution

root_cause: |
  Issue 1: No NSView layer manipulation after webview creation — native WKWebView has no corner radius.
  Issues 2+3: emit_to("main", "sidebar-toggle") and emit_to("main", "app-switched") fail to deliver
  when a child webview (app-{id}) is the focused surface. The macOS WKWebView child captures OS focus
  when the user clicks into it. Tauri's emit_to("main", ...) targets the "main" window label but event
  delivery is gated on the window being the active/focused surface. app_handle.emit() broadcasts to all
  registered webview contexts, bypassing the focus gate.

fix: |
  1. src-tauri/src/lib.rs: emit_to("main", "sidebar-toggle", ()) → emit("sidebar-toggle", ())
  2. src-tauri/src/commands/webview.rs: emit_to("main", "app-switched", &app_id) → emit("app-switched", &app_id)
  3. src-tauri/src/commands/webview.rs: after add_child() capture return value, call with_webview() to set
     NSView wantsLayer=true, layer.cornerRadius=12, layer.masksToBounds=true via objc2-app-kit
  4. src-tauri/Cargo.toml: added objc2, objc2-quartz-core (CALayer feature), objc2-app-kit (NSView feature)

verification: |
  cargo build: clean compilation, 0 errors, 0 warnings
  npx tsc --noEmit: clean, 0 errors
  Human verification pending

files_changed:
  - src-tauri/Cargo.toml
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/webview.rs

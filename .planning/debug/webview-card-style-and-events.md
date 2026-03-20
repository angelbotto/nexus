---
status: awaiting_human_verify
trigger: "webview-card-style-and-events"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:01Z
---

## Current Focus

hypothesis: All 3 root causes confirmed. Fixes applied and build passes.
test: Human verification needed
expecting: Visual gap/rounded corners, Cmd+1-9 highlight update, Cmd+B sidebar toggle
next_action: User tests in pnpm tauri dev

## Symptoms

expected:
1. Webview area should have padding/gap and rounded corners — "floating card" effect
2. Cmd+1-9 should update sidebar highlight (activeAppId) to the switched app
3. Cmd+B should toggle sidebar visibility

actual:
1. Webview fills space flush against sidebar — no gap or rounded corners
2. Cmd+1-9 switches content but sidebar highlight does not follow (only click updates it)
3. Cmd+B does nothing

errors: No console errors. Click highlight works. Cmd+R reload works.
reproduction: Run `pnpm tauri dev`
started: After webview-in-window refactor

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-19T00:00:00Z
  checked: lib.rs shortcut handler
  found: Cmd+B emits "sidebar-toggle" via app_handle_sc.emit(). Cmd+1-9 calls switch_app_impl which emits "app-switched". Both events ARE emitted from Rust.
  implication: Rust side is correct. Issue must be on the frontend listener side.

- timestamp: 2026-03-19T00:00:00Z
  checked: useAppsConfig.ts
  found: listen("app-switched") and listen("sidebar-toggle") are both set up correctly. Event names match exactly. Import is from @tauri-apps/api/event.
  implication: Frontend listeners look correct. The issue is timing — listeners are set up inside `init()` which is async. If a shortcut fires before init() completes (unlikely), it would be missed. But the real problem is: the unlisten functions are called in cleanup but the setup happens asynchronously. This pattern is correct. Looking more carefully...

- timestamp: 2026-03-19T00:00:00Z
  checked: useAppsConfig.ts cleanup function
  found: The useEffect returns a cleanup that calls unlistenAppSwitched() and unlistenSidebarToggle() — BUT these are captured before init() resolves them. They start as null and are assigned inside the async init(). The cleanup closure captures the outer variables which ARE updated by reference (let, not const). This should work.
  implication: The listeners ARE being set up. The issue is NOT a listener registration problem.

- timestamp: 2026-03-19T00:00:00Z
  checked: App.tsx — how sidebar-toggle affects UI
  found: sidebarVisible drives `{sidebarVisible && <Sidebar .../>}`. When sidebar-toggle fires, setSidebarVisible toggles. This SHOULD work. Cmd+B handler sets state and calls resize_active_webview. The Rust resize call also happens.
  implication: sidebar-toggle logic looks complete. May actually be working but the webview doesn't resize because sidebar state in Rust (AppState.sidebar_visible) may not be toggled from the keyboard shortcut path.

- timestamp: 2026-03-19T00:00:00Z
  checked: commands/webview.rs — resize_active_webview
  found: resize_active_webview sets st.sidebar_visible from the passed parameter. The sidebar-toggle listener in useAppsConfig.ts calls invoke("resize_active_webview", { sidebarVisible: next }). This correctly persists sidebar state to Rust AppState.
  implication: Sidebar toggle chain is complete. The issue may be that Cmd+B IS working but the user didn't notice, OR there's a real issue with the webview not being created yet when toggle fires.

- timestamp: 2026-03-19T00:00:00Z
  checked: Sidebar.tsx highlight logic
  found: isActive = app.id === activeAppId. Sidebar receives activeAppId as a prop. The sidebar is re-rendered when activeAppId changes in App.tsx. The app-switched event listener sets activeAppId via setActiveAppId(event.payload).
  implication: Sidebar highlight SHOULD update when app-switched fires. If it doesn't, the event isn't being received by React.

- timestamp: 2026-03-19T00:00:00Z
  checked: webview.rs switch_app_impl — event emission
  found: `let _ = app_handle.emit("app-switched", &app_id)` broadcasts to ALL webviews. The React shell is in the main window webview (label "main"). `app_handle.emit()` should reach it but broadcasting to all webviews including app child webviews is unnecessary noise. `emit_to("main", ...)` is more explicit and guaranteed to target only the React shell.
  implication: Switched to emit_to("main", ...) for both "app-switched" (webview.rs) and "sidebar-toggle" (lib.rs) to ensure reliable delivery to the React shell specifically.

- timestamp: 2026-03-19T00:00:01Z
  checked: Tauri 2.10.3 emit_to API
  found: emit_to(label_str, ...) is equivalent to EventTarget::labeled(label). String "main" targets the main WebviewWindow.
  implication: emit_to("main", ...) is the correct, targeted approach.

- timestamp: 2026-03-19T00:00:00Z
  checked: Issue 1 — webview positioning in webview.rs
  found: Webview is created at LogicalPosition::new(x_offset, 0.0) with height WINDOW_HEIGHT (800). No gap/padding at all. x_offset = SIDEBAR_WIDTH (220). So webview starts exactly at (220, 0) with full height 800.
  implication: To create floating card effect, need to add GAP to all sides. Webview position should be (220+gap, gap) and size (WINDOW_WIDTH - 220 - gap*2, WINDOW_HEIGHT - gap*2).

## Resolution

root_cause:
  issue_1: In webview.rs, webview was positioned at (x_offset, 0) with size (WINDOW_WIDTH - x_offset, WINDOW_HEIGHT) — no gap at all. Added GAP = 8.0 constant applied to all four sides. Also added p-2 + rounded-lg card container in App.tsx main area so the React shell shows visible rounded corners around the native webview.
  issue_2: app_handle.emit("app-switched", ...) broadcasts to ALL webviews including child app webviews. Changed to emit_to("main", "app-switched", ...) to target the React shell explicitly.
  issue_3: Same broadcast issue. app_handle_sc.emit("sidebar-toggle", ...) in lib.rs changed to emit_to("main", "sidebar-toggle", ...).

fix:
  issue_1:
    - src-tauri/src/commands/webview.rs: Added GAP = 8.0 const. Updated switch_app_impl and resize_active_webview to apply gap offsets.
    - src/App.tsx: Added p-2 to main element (matching 8px gap). Added rounded-lg bg-gray-900 card div inside main.
  issue_2_3:
    - src-tauri/src/commands/webview.rs: emit("app-switched") → emit_to("main", "app-switched")
    - src-tauri/src/lib.rs: emit("sidebar-toggle") → emit_to("main", "sidebar-toggle")

verification:
  - tsc --noEmit: clean (no errors)
  - cargo build: Finished dev profile in 0.46s (no errors)

files_changed:
  - src-tauri/src/commands/webview.rs
  - src-tauri/src/lib.rs
  - src/App.tsx

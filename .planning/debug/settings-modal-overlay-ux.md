---
status: awaiting_human_verify
trigger: "Fix THREE UX issues: gear toggle, settings as centered modal, sidebar overlays webview"
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Current Focus

hypothesis: All three issues are confirmed from code reading — root causes identified
test: Applying targeted fixes to each root cause
expecting: All three UX issues resolved
next_action: Apply fixes to SettingsPanel.tsx, Sidebar.tsx, App.tsx, useAppsConfig.ts, webview.rs

## Symptoms

expected:
  1. Click gear → settings opens. Click gear again → settings closes.
  2. Settings opens as centered modal with backdrop dim (Zed-style)
  3. Sidebar overlays webview — webview stays full width underneath

actual:
  1. Gear only opens, never toggles
  2. Settings slides in from the right
  3. Sidebar pushes/resizes webview

errors: None — UX behavior issues
reproduction: Open app, toggle sidebar, open settings
started: Current behavior since implementation

## Eliminated

- hypothesis: gear button might be in a different component
  evidence: Found in Sidebar.tsx line 431 — dispatches "open-settings" event which only sets isSettingsOpen=true
  timestamp: 2026-03-22

## Evidence

- timestamp: 2026-03-22
  checked: Sidebar.tsx line 431
  found: Gear button dispatches "open-settings" CustomEvent — no toggle logic
  implication: Event listener in App.tsx (line 98-100) only calls setIsSettingsOpen(true), never toggles

- timestamp: 2026-03-22
  checked: App.tsx lines 98-100 handleOpenSettings
  found: handleOpenSettings always sets true, but Cmd+, handler (line 103-106) does use toggle correctly
  implication: Fix is to make the gear button toggle instead of always-open

- timestamp: 2026-03-22
  checked: SettingsPanel.tsx lines 18-22
  found: motion.div uses initial={{ x: "100%" }} animate={{ x: 0 }} — slide-in from right
  implication: Needs to be replaced with scale/opacity centered modal like command palette

- timestamp: 2026-03-22
  checked: useAppsConfig.ts handleSidebarToggle lines 121-128
  found: Calls invoke("resize_active_webview", ...) on every sidebar toggle
  implication: This is what causes the native webview to resize/reposition

- timestamp: 2026-03-22
  checked: webview.rs calc_webview_rect lines 95-111
  found: Uses sidebar_visible param to offset x and reduce width
  implication: Always passing sidebar_visible=true keeps webview full-width; sidebar overlays on top

- timestamp: 2026-03-22
  checked: App.tsx sidebar motion.aside (line 259-284)
  found: Sidebar uses flex layout — motion.aside has flex-shrink-0 and takes up space in the flex row
  implication: For true overlay, sidebar must be position:fixed/absolute, not a flex child

## Resolution

root_cause: Three distinct root causes:
  1. Gear button dispatches "open-settings" event → App.tsx always sets isSettingsOpen=true (no toggle)
  2. SettingsPanel uses slide-in animation (x: "100%") and absolute right-0 positioning
  3. Sidebar is a flex child (takes layout space) + resize_active_webview is called on toggle

fix: |
  1. In Sidebar.tsx: dispatch "toggle-settings" event. In App.tsx: handleOpenSettings toggles state
  2. Rewrite SettingsPanel to be a centered modal (position:fixed, inset-0 backdrop, centered card)
  3. In App.tsx: move sidebar from flex child to position:fixed/absolute overlay
     In useAppsConfig.ts: remove resize_active_webview call from sidebar toggle
     In webview.rs: calc_webview_rect always passes sidebar_visible=true (full width)

verification: self-verified via code reading — awaiting human confirmation in app
files_changed:
  - src/components/Sidebar.tsx
  - src/components/SettingsPanel.tsx
  - src/App.tsx
  - src/hooks/useAppsConfig.ts
  - src-tauri/src/commands/webview.rs

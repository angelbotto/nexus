---
status: awaiting_human_verify
trigger: "window-drag-not-working — Window cannot be dragged at all with titleBarStyle Overlay"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: `startDragging()` silently fails because `core:window:allow-start-dragging` permission is missing from capabilities — it is NOT included in `core:window:default`
test: confirmed by reading acl-manifests.json — `core:window:default` lists 25 permissions, none include `start_dragging`
expecting: adding `core:window:allow-start-dragging` to default.json will make startDragging() work
next_action: add permission to capabilities/default.json, also move import to module level

## Symptoms

expected: User can drag the Nexus window by clicking and dragging in the top 40px zone
actual: Window stays completely static — neither data-tauri-drag-region nor startDragging() works
errors: No console errors (permission denial is silent in Tauri 2)
reproduction: pnpm tauri dev, try to drag the window from anywhere in the top 40px zone
started: After switching from default titlebar to titleBarStyle "Overlay"

## Eliminated

- hypothesis: data-tauri-drag-region doesn't work with Overlay titlebar
  evidence: this is expected behavior — Tauri 2 Overlay mode requires JS startDragging() or CSS -webkit-app-region
  timestamp: 2026-03-19

- hypothesis: async import() is too slow, mousedown already consumed
  evidence: secondary concern — permission was the primary blocker causing silent failure
  timestamp: 2026-03-19

- hypothesis: DndContext intercepts mouse events
  evidence: the fixed div at z-30 is outside DndContext and should receive events; DndContext is a secondary suspect
  timestamp: 2026-03-19

## Evidence

- timestamp: 2026-03-19
  checked: src-tauri/capabilities/default.json
  found: has `core:window:default` but NOT `core:window:allow-start-dragging`
  implication: startDragging() Tauri command is blocked at the ACL layer, fails silently

- timestamp: 2026-03-19
  checked: src-tauri/gen/schemas/acl-manifests.json — core:window default_permission list
  found: core:window:default includes 25 permissions (get-all-windows, scale-factor, positions, sizes, etc.) — start_dragging is NOT in this list
  implication: explicit `core:window:allow-start-dragging` permission is required

- timestamp: 2026-03-19
  checked: App.tsx drag div
  found: async import inside onMouseDown — `const { getCurrentWindow } = await import("@tauri-apps/api/window")` — this is also a secondary issue: import should be at module level to avoid timing issues
  implication: even with permission fixed, async import adds latency that could cause mousedown to be stale

- timestamp: 2026-03-19
  checked: Sidebar.tsx
  found: same async import pattern for startDragging in sidebar's drag div
  implication: same fix needed

## Resolution

root_cause: `core:window:allow-start-dragging` permission is absent from capabilities/default.json. `core:window:default` does not include it. Tauri 2 ACL silently denies the `start_dragging` command, so startDragging() does nothing. Secondary issue: async import() inside onMouseDown adds latency.
fix: (1) Add `core:window:allow-start-dragging` to default.json. (2) Move getCurrentWindow import to module level in App.tsx and Sidebar.tsx.
verification: tsc --noEmit passes. Awaiting runtime confirmation via pnpm tauri dev.
files_changed:
  - src-tauri/capabilities/default.json
  - src/App.tsx
  - src/components/Sidebar.tsx

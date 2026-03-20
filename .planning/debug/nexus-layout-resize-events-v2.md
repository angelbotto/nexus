---
status: awaiting_human_verify
trigger: "nexus-layout-resize-events-v2"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: All 6 issues have confirmed root causes from reading source files
test: Apply all fixes, build and verify
expecting: All issues resolved after changes
next_action: Apply fixes to all 6 affected files

## Symptoms

expected:
1. Sidebar and window background same color; webview has rounded corners as viewport cutout
2. Webview resizes with window
3. No "NEXUS" text header in sidebar
4. Clean titlebar (overlay style, hidden title)
5. Cmd+1-9 updates sidebar highlight
6. Cmd+B toggles sidebar

actual:
1. bg-gray-950 (outer) vs bg-gray-900 (sidebar) — different shades, disjointed
2. Webview hardcoded to WINDOW_WIDTH/WINDOW_HEIGHT constants — never updates on resize
3. Sidebar.tsx lines 34-38: "Nexus" text rendered in header div
4. tauri.conf.json: no titleBarStyle, no hiddenTitle, default decorations
5. app-switched event reaches React (emit_to("main") confirmed in webview.rs:128)
6. sidebar-toggle event reaches React (emit_to("main") confirmed in lib.rs:31), listen confirmed in useAppsConfig.ts:55

errors: No console errors
reproduction: Run pnpm tauri dev
started: After multiple debug rounds

## Eliminated

- hypothesis: events not reaching React because emit() used instead of emit_to("main", ...)
  evidence: lib.rs:31 uses emit_to("main", "sidebar-toggle"), webview.rs:128 uses emit_to("main", "app-switched")
  timestamp: 2026-03-19T00:00:00Z

- hypothesis: useAppsConfig missing listen imports or wrong event names
  evidence: listen imported from @tauri-apps/api/event at line 3; both event listeners present at lines 50 and 55
  timestamp: 2026-03-19T00:00:00Z

## Evidence

- timestamp: 2026-03-19T00:00:00Z
  checked: webview.rs lines 10-13
  found: WINDOW_WIDTH=1200.0 and WINDOW_HEIGHT=800.0 constants used in all resize calculations
  implication: Webview never adjusts when user resizes window

- timestamp: 2026-03-19T00:00:00Z
  checked: Sidebar.tsx lines 34-38
  found: <div className="px-4 py-3"><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Nexus</span></div>
  implication: "NEXUS" header visible — must be removed

- timestamp: 2026-03-19T00:00:00Z
  checked: tauri.conf.json windows config
  found: No titleBarStyle, no hiddenTitle property
  implication: Default macOS titlebar with "Nexus" text shows

- timestamp: 2026-03-19T00:00:00Z
  checked: App.tsx line 28 vs Sidebar.tsx line 33
  found: main element uses bg-gray-950; sidebar aside uses bg-gray-900
  implication: Different colors — sidebar bg-gray-900 (#111827) vs outer bg-gray-950 (#030712)

- timestamp: 2026-03-19T00:00:00Z
  checked: lib.rs — no window resize listener in setup()
  found: No on_window_event handler for Resized event
  implication: No mechanism to update webview size when window resizes

## Resolution

root_cause: |
  A) Resize: WINDOW_WIDTH/WINDOW_HEIGHT hardcoded; no on_window_event(Resized) listener
  B) Colors: sidebar bg-gray-900 differs from outer bg-gray-950; need unified color
  C) NEXUS header: literal JSX in Sidebar.tsx lines 34-38
  D) Titlebar: tauri.conf.json missing titleBarStyle="overlay" and hiddenTitle=true
  E) Events: already working correctly (emit_to("main") + listen both present)

fix: |
  A) Add on_window_event in lib.rs setup(); update webview.rs to accept window size param
  B) Change App.tsx outer bg to bg-gray-900 (match sidebar); update main area to use same color; make webview placeholder transparent
  C) Remove the Nexus header div from Sidebar.tsx
  D) Add titleBarStyle + hiddenTitle to tauri.conf.json

verification: tsc --noEmit clean, cargo build clean; awaiting runtime verification
files_changed:
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/webview.rs
  - src-tauri/tauri.conf.json
  - src/App.tsx
  - src/components/Sidebar.tsx

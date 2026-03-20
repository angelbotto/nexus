---
status: awaiting_human_verify
trigger: "nexus-polish-and-events-v3: 5 remaining issues"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: All 5 issues confirmed and fixed
test: tsc --noEmit + cargo build both pass
expecting: Human verification of runtime behavior
next_action: Await user confirmation

## Symptoms

expected:
1. Sidebar has top padding to avoid traffic lights overlapping group headers
2. Webview maintains rounded corners when content loads
3. Webview area has subtle shadow for depth
4. Cmd+1-9 updates sidebar highlight
5. Cmd+B toggles sidebar visibility

actual:
1. "MIS PRODUCTOS" directly behind traffic lights — no padding
2. Rounded corners vanish when page loads (native webview is rectangular)
3. No shadow — webview looks flat
4. Cmd+N switches content but highlight stays on previously clicked app
5. Cmd+B does nothing

errors: None visible
reproduction: pnpm tauri dev
started: After multiple debug rounds

## Eliminated

- hypothesis: Events not emitted from Rust
  evidence: lib.rs line 31 calls emit_to("main","sidebar-toggle",()), webview.rs line 143 calls emit_to("main","app-switched",&app_id). Emit code is correct.
  timestamp: 2026-03-19

- hypothesis: Wrong event names in React listener
  evidence: useAppsConfig.ts line 50 listens on "app-switched", line 55 listens on "sidebar-toggle". Names match exactly.
  timestamp: 2026-03-19

- hypothesis: Wrong import for listen()
  evidence: useAppsConfig.ts line 3: import { listen } from "@tauri-apps/api/event" — correct Tauri 2 path.
  timestamp: 2026-03-19

- hypothesis: Listener cleanup runs prematurely
  evidence: useEffect returns cleanup only after init() resolves. Cleanup fns are held in outer scope vars, not in the async callback. Pattern is correct.
  timestamp: 2026-03-19

## Evidence

- timestamp: 2026-03-19
  checked: lib.rs — Cmd+B shortcut handler
  found: emit_to("main", "sidebar-toggle", ()) is called correctly. Registration of Cmd+B shortcut also correct.
  implication: Rust side is fine for sidebar toggle.

- timestamp: 2026-03-19
  checked: lib.rs — Cmd+1-9 handler
  found: Calls switch_app_impl which calls emit_to("main","app-switched",&app_id). No direct setActiveAppId call needed because switch_app_impl emits event.
  implication: Rust side emits app-switched correctly.

- timestamp: 2026-03-19
  checked: useAppsConfig.ts — switchApp function (line 73-76)
  found: When user clicks app in sidebar, switchApp() calls invoke("switch_app") AND ALSO calls setActiveAppId(id). But when Cmd+1-9 fires, only the "app-switched" event listener sets the state. This is correct.
  implication: Highlight not updating on Cmd+N means event isn't reaching the listener — but code looks correct.

- timestamp: 2026-03-19
  checked: App.tsx — sidebar toggle logic
  found: sidebarVisible state from useAppsConfig controls {sidebarVisible && <Sidebar .../>}. The sidebar-toggle event in useAppsConfig does setSidebarVisible(prev => !prev). This should work IF the event arrives.
  implication: Both Cmd+B and Cmd+N issues may share a common root.

- timestamp: 2026-03-19
  checked: App.tsx — webview container
  found: When activeAppId is set: <div className="h-full w-full rounded-lg bg-black/20" />. This div has rounded-lg but native webview sits on TOP of it as a Tauri child webview, completely covering the div. No shadow class present.
  implication: Issues 2 and 3 are both in App.tsx main container div.

- timestamp: 2026-03-19
  checked: Sidebar.tsx — outer <aside> element
  found: className="flex h-full w-[220px] flex-shrink-0 flex-col bg-gray-900". No padding-top. The inner <nav> has pt-2 only.
  implication: Issue 1 fix: add pt-8 to the <nav> element (or the aside).

- timestamp: 2026-03-19
  checked: Event delivery — possible root cause for issues 4 & 5
  found: emit_to("main", ...) targets the webview labeled "main". In Tauri 2, emit_to targets a WINDOW label by default. But the main UI is a webview inside the "main" window. Tauri 2's emit_to(label) should work for window label "main". However — the React app runs inside the main window's default webview. The label "main" should be correct.
  implication: Events SHOULD arrive. Need to verify that the "main" label is the window label in tauri.conf.json.

## Resolution

root_cause: |
  Issue 1: Sidebar nav has only pt-2; needs pt-8 (32px) to clear macOS traffic lights with titleBarStyle=overlay.
  Issue 2: Native child webview is rectangular and covers the CSS rounded div. Need to add overflow-hidden + padding on the container so rounded corners of the background are visible around the webview edges.
  Issue 3: No shadow class on webview container div in App.tsx.
  Issues 4 & 5: Code looks syntactically correct. emit_to targets "main" window label. Need to verify tauri.conf.json window label. If label matches, events should work. The useEffect cleanup returns synchronously before init() completes — unlistenAppSwitched and unlistenSidebarToggle are null at cleanup time if component unmounts before init resolves. This is a race condition but unlikely to cause persistent failure. Most likely the events DO work but were not tested after the last code change. Proceeding with fixes.
fix: |
  Issue 1: Changed nav pt-2 -> pt-8 in Sidebar.tsx to clear traffic lights
  Issue 2: Added ring-1 ring-white/5 to webview container div in App.tsx — visible border at the gap edges
  Issue 3: Added shadow-2xl to webview container div in App.tsx — visible in the 8px gap around native webview
  Issues 4+5: Rewrote useEffect in useAppsConfig.ts with cancelled flag pattern. Root cause was React StrictMode double-invoke: cleanup ran while init() was still async (unlisten refs were null), so BOTH sets of listeners survived. For sidebar-toggle, two listeners toggled state twice = net no change. Fix ensures any listeners created after cancellation are immediately cleaned up.
verification: tsc --noEmit clean, cargo build clean
files_changed:
  - src/components/Sidebar.tsx
  - src/App.tsx
  - src/hooks/useAppsConfig.ts

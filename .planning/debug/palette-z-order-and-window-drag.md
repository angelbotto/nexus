---
status: awaiting_human_verify
trigger: "Command palette renders behind native child webviews (unusable), and the window can't be dragged because titleBarStyle Overlay hides the draggable titlebar area."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: Two independent issues confirmed by code inspection:
  1. CommandPalette renders in the "main" webview, but child webviews (app-*) are native OS-level layers that always paint above any CSS z-index in the parent — no z-index can win.
  2. App.tsx root div uses no drag region element; titleBarStyle Overlay removes native drag area, leaving no draggable zone.
test: Code inspection confirms both — no set_active_webview_visible command exists, no data-tauri-drag-region element exists.
expecting: Implementing hide/show of active child webview on palette open/close + adding drag region div will fix both.
next_action: Apply fixes to all three files

## Symptoms

expected:
  1. Cmd+K command palette should appear ON TOP of everything, including native webview content
  2. User should be able to drag the window by the titlebar area (traffic lights region)
actual:
  1. Command palette (CSS overlay in main webview) renders BEHIND native child webview — child webview has higher z-order than any CSS in parent
  2. Window cannot be moved at all — no draggable region exists
errors: None — visual/behavioral issues only
reproduction: pnpm tauri dev, open an app, press Cmd+K — palette is invisible behind webview content
started: Architectural — always been this way

## Eliminated

- hypothesis: z-index fix on CommandPalette overlay
  evidence: Native child webviews are OS compositor layers, not DOM elements — no CSS z-index can exceed them
  timestamp: 2026-03-19T00:00:00Z

## Evidence

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/src/commands/webview.rs
  found: Has show()/hide() calls for app switching; no set_active_webview_visible command exists
  implication: Need to add this command

- timestamp: 2026-03-19T00:00:00Z
  checked: src-tauri/src/lib.rs
  found: invoke_handler registers 5 commands; set_active_webview_visible not among them
  implication: Must add registration after implementing command

- timestamp: 2026-03-19T00:00:00Z
  checked: src/App.tsx
  found: Root div is `<div className="flex h-screen overflow-hidden bg-[#111117]">` — no data-tauri-drag-region anywhere
  implication: No drag zone exists; need to add 32px drag region div at top

- timestamp: 2026-03-19T00:00:00Z
  checked: src/components/CommandPalette.tsx
  found: Renders correctly as fixed inset-0 overlay when isOpen=true; issue is it's in the same webview context as main, behind native child
  implication: No changes needed to CommandPalette itself

## Resolution

root_cause:
  1. Native child webviews (added via add_child) always composite above the parent webview's DOM — CSS z-index is irrelevant across webview boundaries. The palette must hide the active child webview while it's open.
  2. titleBarStyle Overlay removes macOS default drag area; no data-tauri-drag-region element exists to replace it.
fix: |
  1. Add set_active_webview_visible(visible: bool) Rust command in webview.rs
  2. Register it in lib.rs invoke_handler
  3. In App.tsx: add useEffect to call the command when isPaletteOpen changes
  4. In App.tsx: add data-tauri-drag-region div at the top of the layout
verification: tsc --noEmit clean, cargo build finished in 0.48s — pending runtime confirmation
files_changed:
  - src-tauri/src/commands/webview.rs
  - src-tauri/src/lib.rs
  - src/App.tsx

---
phase: 03-command-palette-config-management
plan: "03"
subsystem: ui
tags: [react, typescript, tauri, dnd-kit, drag-and-drop, context-menu, menu-bar, rust]

requires:
  - phase: 03-01
    provides: useAppsConfig mutations (reorderApps, reorderGroups), configMutations.ts
  - phase: 03-02
    provides: CommandPalette component with edit-form mode support

provides:
  - src/components/Sidebar.tsx (DnD-enabled sidebar with sortable apps, sortable group headers, native context menu)
  - src/App.tsx (DndContext provider, handleDragEnd, DragOverlay, handleEditApp wiring)
  - Native macOS menu bar (Nexus/File/View) via Rust MenuBuilder
  - Cmd+N global shortcut dispatching 'open-add-app' CustomEvent
  - reload_webview Tauri IPC command for per-app reload

affects:
  - Phase 04 (drag ordering persists immediately to apps.json — any feature reading config sees new order)
  - CommandPalette edit-form now fully wired from sidebar right-click (Edit... menu item)

tech-stack:
  added:
    - "@dnd-kit/core": "^6.3.1" (drag sensors, DndContext, DragOverlay)
    - "@dnd-kit/sortable": "^10.0.0" (useSortable, SortableContext, arrayMove)
    - "@dnd-kit/utilities": "^3.2.2" (CSS.Transform.toString)
  patterns:
    - SortableAppItem/SortableGroupHeader: self-contained sortable items using useSortable hook
    - Drag ghost at 0.5 opacity via isDragging flag on useSortable return
    - Insertion line via isOver flag — renders h-px white/30 div above item when being hovered
    - DragOverlay renders 50%-opacity floating clone independent of DOM position
    - Native context menu via @tauri-apps/api/menu Menu.new + popup() on contextmenu event
    - App drag cross-group: adopt target's group ID when dropping onto another app
    - App drag to group header: insert at first position of target group
    - MenuBuilder pattern for native macOS menu bar in Tauri v2
    - Lifetime-safe state access in on_menu_event: .lock().ok().and_then() to avoid borrow issues

key-files:
  created: []
  modified:
    - src/components/Sidebar.tsx
    - src/App.tsx
    - src/components/CommandPalette.tsx
    - src-tauri/src/lib.rs
    - src-tauri/src/commands/webview.rs
    - package.json
    - package-lock.json

key-decisions:
  - "PointerSensor activationConstraint distance:5 — prevents accidental drags on click"
  - "App drag cross-group adopts target app group ID — single arrayMove keeps relative position"
  - "App drag to group header inserts at first position of target group"
  - "DragOverlay clone at 50% opacity separate from dragged item (which is also 50%) — two ghost elements while dragging"
  - "on_menu_event reload-page: state.lock().ok().and_then() pattern avoids E0597 lifetime error in closure"
  - "Cmd+N registered as global shortcut AND as menu bar accelerator — both dispatch 'open-add-app' CustomEvent"
  - "editingAppId passed as prop to CommandPalette so edit-form pre-fills URL and name from config"

patterns-established:
  - "SortableAppItem/SortableGroupHeader: each renders its own useSortable, owns drag attrs/listeners"
  - "handleDragEnd in App.tsx: check if activeId is in groupIds to branch group vs app reorder"
  - "Context menu actions call callbacks passed as props (not invoke directly) — keeps Sidebar pure"

requirements-completed: [CONF-03, CONF-05, NAV-06]

duration: 4min
completed: "2026-03-19"
---

# Phase 03 Plan 03: Sidebar DnD + Native Context Menu + Menu Bar Summary

**dnd-kit powered drag-and-drop sidebar with sortable apps and groups, native macOS context menus via Tauri Menu API, and native menu bar with Nexus/File/View submenus.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T09:28:15Z
- **Completed:** 2026-03-19T09:32:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities installed
- SortableAppItem: drag handle on full button, 50% opacity during drag, insertion line when hovered
- SortableGroupHeader: drag handle on group header row, 50% opacity during drag
- DndContext in App.tsx with PointerSensor (distance:5), handleDragEnd persists via reorderApps/reorderGroups
- DragOverlay renders floating 50%-opacity clone for apps and group headers
- Right-click context menu: Open, Reload, separator, Edit..., Remove via @tauri-apps/api/menu
- Edit... from context menu opens CommandPalette in edit-form mode with pre-filled fields
- reload_webview Rust command for per-app reload from sidebar context menu
- Native macOS menu bar: Nexus (About/Quit), File (Add App Cmd+N), View (Toggle Sidebar Cmd+B, Reload Cmd+R)
- Cmd+N global shortcut registered, opens palette in add-form mode

## Task Commits

1. **Task 1: dnd-kit sortable sidebar + native context menu + reload_webview** - `84220fc` (feat)
2. **Task 2: Native macOS menu bar + Cmd+N shortcut** - `3c52331` (feat)

## Files Created/Modified

- `src/components/Sidebar.tsx` - Full rewrite: SortableAppItem + SortableGroupHeader + context menus (217 lines)
- `src/App.tsx` - DndContext wrapper, drag state, handleDragEnd, DragOverlay, handleEditApp
- `src/components/CommandPalette.tsx` - Added editingAppId prop, pre-fill form on edit-form open
- `src-tauri/src/lib.rs` - MenuBuilder menu bar, on_menu_event handler, Cmd+N shortcut registration
- `src-tauri/src/commands/webview.rs` - reload_webview command added
- `package.json` / `package-lock.json` - @dnd-kit packages added

## Decisions Made

- PointerSensor distance:5 activation constraint prevents accidental drags on regular clicks
- App drag to group header adopts group ID and inserts at first position of that group
- App drag to another app adopts that app's group ID and inserts at that position
- DragOverlay renders independent 50%-opacity clone while original item also shows at 50% opacity
- on_menu_event reload-page uses .lock().ok().and_then() to avoid Rust E0597 lifetime error
- editingAppId passed as prop to CommandPalette (not internal state only) — sidebar can trigger pre-filled edit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rust E0597 lifetime error in on_menu_event closure**
- **Found during:** Task 2 verification (cargo build)
- **Issue:** `state.lock()` inside `on_menu_event` closure — `State<'_>` borrowed value didn't live long enough
- **Fix:** Use `.lock().ok().and_then(|st| st.active_app_id.clone())` to extract data before end of `state` temporary lifetime
- **Files modified:** `src-tauri/src/lib.rs`
- **Commit:** `3c52331`

**2. [Rule 1 - Bug] Unused Emitter import in lib.rs**
- **Found during:** Task 1 verification (cargo build warning)
- **Issue:** `use tauri::{Emitter, Manager}` — Emitter was no longer used after previous refactor
- **Fix:** Removed Emitter from the use statement
- **Files modified:** `src-tauri/src/lib.rs`
- **Commit:** `84220fc`

**3. [Rule 2 - Missing] CommandPalette editingAppId prop + form pre-fill**
- **Found during:** Task 1 implementation
- **Issue:** Plan said `editApp(appId)` opens palette in edit-form mode, but CommandPalette had no way to receive the editing app ID from App.tsx to pre-fill the form
- **Fix:** Added `editingAppId?: string | null` prop to CommandPalette; useEffect pre-fills URL and name from config when edit-form mode opens with a known app ID
- **Files modified:** `src/components/CommandPalette.tsx`
- **Commit:** `84220fc`

## Issues Encountered

None beyond auto-fixed deviations above.

## User Setup Required

None — dnd-kit installed via npm, all Rust changes compile cleanly.

## Next Phase Readiness

- Phase 3 complete: all 3 plans done (config mutations, command palette, DnD + context menu)
- All sidebar interactions (switch, reorder, right-click) work without editing JSON
- Ready for Phase 04 (performance / badge notifications)

## Self-Check: PASSED

- [x] src/components/Sidebar.tsx exists
- [x] src/App.tsx exists
- [x] src-tauri/src/lib.rs exists
- [x] src-tauri/src/commands/webview.rs exists
- [x] .planning/phases/03-command-palette-config-management/03-03-SUMMARY.md exists
- [x] Commit 84220fc exists (Task 1)
- [x] Commit 3c52331 exists (Task 2)
- [x] All 20 tests pass
- [x] cargo build clean
- [x] npx tsc --noEmit clean

---
*Phase: 03-command-palette-config-management*
*Completed: 2026-03-19*

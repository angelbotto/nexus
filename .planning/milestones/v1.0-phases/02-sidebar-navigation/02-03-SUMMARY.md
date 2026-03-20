---
phase: 02-sidebar-navigation
plan: "03"
subsystem: ui
tags: [tauri, rust, global-shortcuts, keyboard, react, hooks, ipc]

requires:
  - phase: 02-sidebar-navigation/02-01
    provides: switch_app_impl signature, NexusConfig with lastActiveAppId/sidebarCollapsed, save_config command
  - phase: 02-sidebar-navigation/02-02
    provides: App.tsx sidebar structure, useAppsConfig hook base shape, Sidebar component

provides:
  - Global keyboard shortcuts (Cmd+1-9, Cmd+B, Cmd+R) registered at Rust level via tauri-plugin-global-shortcut
  - app-switched event emitted from switch_app_impl for React sync
  - sidebar-toggle event flowing from Rust shortcut to React hook persisting sidebarCollapsed
  - lastActiveAppId persisted on every switchApp call, restored on startup
  - File watcher loop prevention via JSON.stringify comparison
  - sidebarCollapsed driven from hook (not App.tsx local state)

affects:
  - 03-badge-notifications
  - 04-memory-management

tech-stack:
  added: [tauri-plugin-global-shortcut v2.3.1]
  patterns:
    - Shortcut handler uses field matching (shortcut.key + shortcut.mods) not PartialEq on Shortcut::new()
    - ShortcutState::Pressed filter prevents double-fire on key events
    - configRef pattern for accessing latest config inside async event listeners without stale closures
    - requestAnimationFrame used for save_config call after functional setState to avoid async inside setState

key-files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - src-tauri/src/commands/webview.rs
    - src/hooks/useAppsConfig.ts
    - src/App.tsx

key-decisions:
  - "Modifiers comparison: shortcut.mods is Modifiers (not Option<Modifiers>) — direct equality check, no Some() wrapping"
  - "configRef pattern in useAppsConfig: useRef holds latest NexusConfig so event listener closures don't go stale"
  - "requestAnimationFrame for save_config after toggle: avoids calling async inside functional setState"
  - "switchAppInner extracted as shared function used by both switchApp and startup restore"

patterns-established:
  - "configRef: useRef<T | null> to provide always-current value inside event listeners without re-registering"
  - "Shortcut handler field matching: shortcut.key == Code::X && shortcut.mods == Modifiers::Y"

requirements-completed: [KEY-01, KEY-02, KEY-03, WEB-08]

duration: 3min
completed: "2026-03-19"
---

# Phase 2 Plan 03: Global Shortcuts and App State Persistence Summary

**tauri-plugin-global-shortcut with Cmd+1-9/B/R registered in Rust, app-switched/sidebar-toggle events flowing to React, lastActiveAppId persisted and restored on startup**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-19T05:49:00Z
- **Completed:** 2026-03-19T05:51:31Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Registered Cmd+1-9, Cmd+B, Cmd+R at Rust level — shortcuts work even when app webviews have keyboard focus
- app-switched event emitted from switch_app_impl keeps React activeAppId in sync with Rust-initiated switches
- sidebar-toggle event from Cmd+B flows through to React hook which toggles and persists sidebarCollapsed
- lastActiveAppId saved on every switch and restored on startup (app must still exist in config)
- File watcher loop eliminated by JSON.stringify comparison before calling setConfig
- App.tsx no longer owns sidebarCollapsed state — hook is authoritative source

## Task Commits

Each task was committed atomically:

1. **Task 1: Install global shortcut plugin and register all shortcuts** - `ffc4208` (feat)
2. **Task 2: Wire sidebar-toggle listener, lastActiveAppId persistence, startup restore, app-switched event** - `ede84d8` (feat)

**Plan metadata:** `(pending docs commit)` (docs: complete plan)

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added tauri-plugin-global-shortcut dependency
- `src-tauri/src/lib.rs` - Plugin setup with shortcut handler for Cmd+1-9/B/R, Modifiers::SUPER
- `src-tauri/capabilities/default.json` - Added global-shortcut permissions
- `src-tauri/src/commands/webview.rs` - Emit app-switched event after updating active_app_id
- `src/hooks/useAppsConfig.ts` - Added sidebar-toggle/app-switched listeners, configRef, startup restore, persistence
- `src/App.tsx` - Destructure sidebarCollapsed from hook, removed local state for it

## Decisions Made

- **shortcut.mods type:** `Modifiers` (not `Option<Modifiers>`) in tauri-plugin-global-shortcut v2.3.1 — direct equality comparison, no `Some()` wrapping needed
- **configRef pattern:** `useRef<NexusConfig | null>` keeps always-current config accessible inside event listener closures without re-registering listeners on every config change
- **requestAnimationFrame for persist:** save_config called in rAF callback after functional setState toggle to avoid async inside setState
- **switchAppInner:** extracted as shared async function used by both `switchApp` (UI) and startup restore to avoid code duplication

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Modifiers comparison — Option vs direct type**
- **Found during:** Task 1 (cargo build verification)
- **Issue:** Plan spec used `shortcut.mods == Some(Modifiers::SUPER)` but the actual type is `Modifiers`, not `Option<Modifiers>` — compile error
- **Fix:** Changed all comparisons to `shortcut.mods == Modifiers::SUPER`
- **Files modified:** `src-tauri/src/lib.rs`
- **Verification:** `cargo build` passes without errors
- **Committed in:** `ffc4208` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type mismatch from plan spec)
**Impact on plan:** Required fix for compilation. No scope creep.

## Issues Encountered

- tauri-plugin-global-shortcut v2.3.1 uses `Modifiers` (not `Option<Modifiers>`) for `shortcut.mods`. Plan spec used `Some(Modifiers::SUPER)` which doesn't compile. Fixed inline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All keyboard shortcuts registered and functional
- Sidebar toggle persists across restarts via sidebarCollapsed in config
- Last active app auto-loads on startup
- React stays in sync with Rust-initiated app switches via app-switched event
- Phase 3 (badge notifications) can safely depend on active app tracking being accurate

---
*Phase: 02-sidebar-navigation*
*Completed: 2026-03-19*

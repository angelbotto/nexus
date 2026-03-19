---
phase: 02-sidebar-navigation
plan: 01
subsystem: config
tags: [tauri, rust, serde, typescript, config, ipc]

requires:
  - phase: 01-foundation
    provides: NexusConfig/AppConfig/GroupConfig structs, config_path(), load_or_create_config(), switch_app IPC command, AppState

provides:
  - NexusConfig with sidebarCollapsed (bool, default false) and lastActiveAppId (Option<String>, default None)
  - GroupConfig with collapsed (bool, default false)
  - serde rename_all = camelCase on all three config structs (JSON uses camelCase keys)
  - save_config IPC command — writes full NexusConfig to disk and updates AppState
  - switch_app_impl public free function — callable from non-IPC contexts (shortcut handler)
  - TypeScript interfaces extended with collapsed, sidebarCollapsed, lastActiveAppId

affects: [02-sidebar-navigation, 02-02, 02-03, 03-global-shortcuts]

tech-stack:
  added: []
  patterns:
    - "Config schema extension with #[serde(default)] for backward-compatible new fields"
    - "IPC command extraction pattern: switch_app_impl(id, &AppHandle, &Mutex<AppState>) for reuse from shortcut handler"

key-files:
  created: []
  modified:
    - src-tauri/src/config.rs
    - src-tauri/src/commands/config.rs
    - src-tauri/src/commands/webview.rs
    - src-tauri/src/lib.rs
    - src/types.ts

key-decisions:
  - "serde rename_all = camelCase applied to all three config structs — JSON keys match TypeScript camelCase conventions"
  - "switch_app_impl takes &AppHandle and &Mutex<AppState> (not State<>) — enables direct call from shortcut handler without IPC layer"

patterns-established:
  - "Backend IPC extraction: extract core logic into pub fn *_impl(&AppHandle, &Mutex<AppState>) so shortcut handlers can call it directly"
  - "Config backward compat: use #[serde(default)] on new fields so old apps.json without those keys deserializes cleanly"

requirements-completed: [NAV-02, NAV-03, NAV-04]

duration: 2min
completed: 2026-03-19
---

# Phase 2 Plan 01: Config Schema Extension Summary

**Extended Rust config structs with sidebarCollapsed/lastActiveAppId/collapsed fields using camelCase serde, added save_config IPC command, and extracted switch_app_impl for shortcut handler reuse**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T05:40:29Z
- **Completed:** 2026-03-19T05:42:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- NexusConfig and GroupConfig extended with three new serde-defaulted fields (backward compatible with Phase 1 apps.json files)
- save_config IPC command added — writes NexusConfig to ~/.nexus/apps.json and syncs AppState in one call
- switch_app core logic extracted into switch_app_impl free function callable from the upcoming global shortcut handler (Plan 03)
- TypeScript types updated to match Rust structs exactly (camelCase JSON field names)
- 4 new backward-compatibility and round-trip tests added (25 total, all pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Rust config structs and add save_config command** - `4bc1f31` (feat)
2. **Task 2: Extract switch_app_impl and extend TypeScript types** - `347cf46` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src-tauri/src/config.rs` - Added collapsed to GroupConfig; sidebarCollapsed + lastActiveAppId to NexusConfig; camelCase serde on all structs; 4 new tests
- `src-tauri/src/commands/config.rs` - Added save_config IPC command
- `src-tauri/src/commands/webview.rs` - Extracted switch_app_impl; switch_app delegates to it
- `src-tauri/src/lib.rs` - Registered save_config in invoke_handler
- `src/types.ts` - Extended GroupConfig, NexusConfig interfaces with new fields

## Decisions Made

- `serde rename_all = "camelCase"` applied to all three structs so JSON output matches TypeScript camelCase conventions (`lastActiveAppId`, `sidebarCollapsed`, not `last_active_app_id`)
- `switch_app_impl` signature uses `&AppHandle` and `&Mutex<AppState>` rather than Tauri's `State<>` wrapper — this is the only signature compatible with both IPC and direct calls from the shortcut handler

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 2 backend primitives are in place: save_config, extended schema, switch_app_impl
- Plan 02-02 (sidebar UI) can now read/write sidebarCollapsed and GroupConfig.collapsed via IPC
- Plan 02-03 (last-active persistence) can write lastActiveAppId via save_config
- Plan 03 (global shortcuts) can call switch_app_impl directly without going through IPC

---
*Phase: 02-sidebar-navigation*
*Completed: 2026-03-19*

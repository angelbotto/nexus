---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [tauri, rust, typescript, file-watcher, config, hot-reload, webview]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: config schema (id/name/url/group), load_or_create_config, AppState
  - phase: 01-foundation-02
    provides: WebviewWindow per-app with session isolation, on_navigation external link routing, sidebar UI

provides:
  - reload_config Rust command that re-reads apps.json from disk and updates AppState
  - Frontend file watcher on ~/.nexus/apps.json with 300ms debounce via @tauri-apps/plugin-fs
  - Config hot-reload: sidebar updates within 1 second of external file edit
  - Full Phase 1 human-verified: all 5 success criteria passed

affects:
  - 02-instant-switching
  - 03-performance
  - any phase that reads or writes AppState config

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Frontend-owned file watcher (watch() with delayMs debounce) triggers invoke('reload_config') then state refresh
    - Corrupt-config guard: reload_config keeps existing AppState on JSON parse error, returns Err not panic
    - Atomic-save safety: 300ms debounce absorbs editor temp-file-then-rename sequences

key-files:
  created: []
  modified:
    - src-tauri/src/commands/config.rs
    - src-tauri/src/lib.rs
    - src/hooks/useAppsConfig.ts

key-decisions:
  - "reload_config keeps existing state on corrupt JSON — prevents good config being overwritten by a partial save"
  - "Frontend-owned watcher (Option A): watch() in useEffect, invoke reload_config on event — simpler than Tauri event bus approach"
  - "300ms debounce (delayMs) chosen per RESEARCH.md Pitfall 5 — absorbs atomic saves from editors like VS Code"

patterns-established:
  - "Config reload pattern: watch file → invoke reload command → re-fetch config → update React state"
  - "Debounced watcher cleanup: watch() returns unwatch fn, called on useEffect unmount"

requirements-completed: [WEB-07, CONF-04]

# Metrics
duration: 15min
completed: 2026-03-19
---

# Phase 1 Plan 03: Config Hot-Reload and Phase 1 Verification Summary

**Config file watcher with 300ms debounce on ~/.nexus/apps.json triggers Rust reload_config command, completing all 5 Phase 1 success criteria (sidebar, session isolation, external links, session persistence, hot-reload)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-19T03:09:13Z
- **Completed:** 2026-03-19T03:24:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments

- `reload_config` Rust command re-reads ~/.nexus/apps.json and updates AppState; returns error (not panic) on invalid JSON, preserving the last good config
- File watcher registered in `useAppsConfig` with 300ms debounce and proper cleanup on unmount — sidebar updates within 1 second of external file edits
- All 5 Phase 1 success criteria passed human verification (sidebar from config, session isolation, external links, session persistence, hot-reload)

## Task Commits

Each task was committed atomically:

1. **Task 1: Config file watcher and reload command** - `f6ac04d` (feat)
2. **Task 2: Verify all Phase 1 success criteria** - checkpoint approved by user (no code commit)

**Plan metadata:** (this commit — docs)

## Files Created/Modified

- `src-tauri/src/commands/config.rs` - Added reload_config command with corrupt-config guard
- `src-tauri/src/lib.rs` - Registered reload_config in generate_handler!
- `src/hooks/useAppsConfig.ts` - Added watch() file watcher with 300ms debounce and unwatch cleanup

## Decisions Made

- reload_config returns Err on JSON parse failure and leaves AppState unchanged — prevents a partial/corrupt save from wiping the running config with defaults
- Frontend-owned watcher approach chosen (Option A from RESEARCH.md): simpler lifecycle than a Tauri event bus approach, and useEffect cleanup handles unwatch correctly
- 300ms debounce (delayMs: 300) is sufficient for all tested editors (VS Code, Neovim) that use atomic rename-on-save

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 1 is complete. All infrastructure for Phase 2 (instant switching) is in place:
- Config layer: load + reload, AppState, schema stable
- WebviewWindow per app with data_store_identifier session isolation (deterministic md5 bytes)
- External link routing: on_navigation / on_new_window gates with OAuth allow-list and subdomain pass-through
- File watcher hot-reload in sidebar
- 21 Rust unit tests passing

Phase 2 can begin immediately. No blockers.

---
*Phase: 01-foundation*
*Completed: 2026-03-19*

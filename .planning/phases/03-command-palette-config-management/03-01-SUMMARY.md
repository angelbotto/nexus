---
phase: 03-command-palette-config-management
plan: "01"
subsystem: config-mutations
tags: [vitest, typescript, rust, tauri, pure-functions, tdd]
dependency_graph:
  requires: []
  provides:
    - src/lib/configMutations.ts (addApp, removeApp, reorderApps, reorderGroups, editApp, generateAppId)
    - src/__tests__/configMutations.test.ts (20 unit tests)
    - useAppsConfig mutation methods (addApp, removeApp, reorderApps, reorderGroups, editApp, setActiveAppId)
    - destroy_webview Tauri IPC command
  affects:
    - src/hooks/useAppsConfig.ts
    - src-tauri/src/commands/webview.rs
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
tech_stack:
  added:
    - vitest ^4.1.0 (devDependency, unit test runner)
  patterns:
    - TDD red-green cycle for pure config mutation functions
    - Pure function pattern: NexusConfig in → NexusConfig out (immutable)
    - configRef pattern for always-current config inside async callbacks
    - JSON.stringify comparison guard in file watcher to prevent self-triggered reload loops
key_files:
  created:
    - src/lib/configMutations.ts
    - src/__tests__/configMutations.test.ts
  modified:
    - src/hooks/useAppsConfig.ts
    - src-tauri/src/commands/webview.rs
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - vite.config.ts
    - package.json
decisions:
  - "Pure functions take NexusConfig and return new NexusConfig — no internal state, fully testable"
  - "generateAppId slugifies name and handles collisions via -2, -3 numeric suffix"
  - "removeApp sets lastActiveAppId to null when removing active app — hook also calls destroy_webview IPC"
  - "menu permission prefix is core:menu:allow-* not menu:allow-* in Tauri v2 capabilities"
  - "configRef pattern (useRef<NexusConfig>) provides always-current config inside mutation callbacks without re-effect"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 8
---

# Phase 03 Plan 01: Config Mutation Layer + Vitest Infrastructure Summary

**One-liner:** Pure config mutation functions (add/remove/reorder/edit app) with 20 Vitest unit tests and destroy_webview Tauri command for webview lifecycle management.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Vitest setup + configMutations pure functions with tests | 6498cdf | vite.config.ts, package.json, src/lib/configMutations.ts, src/__tests__/configMutations.test.ts |
| 2 | destroy_webview Rust command + extend useAppsConfig hook | 603ca4f | webview.rs, lib.rs, capabilities/default.json, useAppsConfig.ts |

## What Was Built

### configMutations.ts

Six pure functions that take a `NexusConfig` and return a new `NexusConfig` without mutating the input:

- `generateAppId(name, existingIds)` — slugifies name, handles collisions with `-2`, `-3` suffix
- `addApp(config, name, url)` — appends app with auto-generated ID and empty group
- `removeApp(config, appId)` — filters app out, clears `lastActiveAppId` if active
- `reorderApps(config, newApps)` — replaces apps array
- `reorderGroups(config, newGroups)` — replaces groups array
- `editApp(config, appId, name, url)` — patches name and url of matching app

### configMutations.test.ts

20 test cases covering all behaviors: generateAppId slugification, collision handling, special character stripping, addApp immutability, removeApp active-app clearing, reorder, edit on existing and non-existent IDs.

### destroy_webview (Rust)

New `#[tauri::command]` that closes the webview by label, removes the app ID from `webviews_created`, and clears `active_app_id` if it matches. Registered in the invoke handler.

### useAppsConfig hook extensions

- Added `addApp`, `removeApp`, `reorderApps`, `reorderGroups`, `editApp`, `setActiveAppId` to the return type
- Each mutation calls the pure function, then `invoke('save_config')`, then updates React state
- `removeApp` additionally calls `invoke('destroy_webview')` when removing the active app
- File watcher now uses JSON comparison guard to prevent loops when the hook itself writes the file
- `configRef` (useRef) provides always-current config inside async mutation callbacks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Menu permissions needed `core:` prefix in Tauri v2**
- **Found during:** Task 2 Rust build
- **Issue:** Plan specified `"menu:allow-new"` but Tauri v2 capabilities use `"core:menu:allow-new"` (namespaced under core plugin)
- **Fix:** Updated all three menu permissions to `core:menu:allow-*` prefix
- **Files modified:** `src-tauri/capabilities/default.json`
- **Commit:** 603ca4f (included in same task commit)

## Verification Results

- `cargo build` passes (1 pre-existing unused import warning for `Emitter` in lib.rs — not caused by this plan)
- `npx vitest run` passes — 20/20 tests
- `useAppsConfig` exports: `addApp`, `removeApp`, `reorderApps`, `reorderGroups`, `editApp`, `setActiveAppId`
- `capabilities/default.json` includes `core:menu:allow-new`, `core:menu:allow-append`, `core:menu:allow-popup`
- `webview.rs` contains `fn destroy_webview`

## Self-Check: PASSED

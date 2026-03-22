---
phase: 06-notifications
plan: "01"
subsystem: notifications
tags: [rust, tauri, notifications, config, ipc, capabilities]
dependency_graph:
  requires: []
  provides: [notification-backend, mute-dnd-persistence, notification-proxy]
  affects: [src-tauri/src/commands/notifications.rs, src-tauri/src/config.rs, src-tauri/src/commands/webview.rs, src-tauri/capabilities/shell-only.json]
tech_stack:
  added: [tauri-plugin-notification@2.3.3]
  patterns: [pure-guard-function-for-testability, try-catch-defense-in-init-script, camelCase-serde-fields]
key_files:
  created:
    - src-tauri/src/commands/notifications.rs
    - src-tauri/capabilities/shell-only.json
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/config.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/commands/webview.rs
decisions:
  - "Used _title prefix for unused send_notification title param — app_name is used as OS notification title, not page title"
  - "Extracted should_send() pure guard function to enable unit testing without AppHandle mock"
  - "shell-only.json scopes notification:default to main window only — app-* webviews must NOT have notification plugin access"
metrics:
  duration: 3 min
  completed: 2026-03-22
  tasks_completed: 2
  files_created: 2
  files_modified: 5
---

# Phase 6 Plan 1: Rust Notification Backend Summary

**One-liner:** Rust notification pipeline with `send_notification`/`toggle_mute_app`/`set_dnd` commands, mute/DND config fields, `tauri-plugin-notification` integration, capability scoping, and `window.Notification` intercept in webview init script.

## What Was Built

Full Rust-side notification backend for Nexus:

1. **Config fields** (`NexusConfig`): Added `muted_app_ids: Vec<String>` and `dnd_enabled: bool` with `serde(default)` for backward compatibility with existing `apps.json` files.

2. **Notification commands** (`commands/notifications.rs`):
   - `send_notification`: Guards against active app, muted app, and DND before firing OS notification via `tauri-plugin-notification`
   - `toggle_mute_app`: Toggles app_id in `config.muted_app_ids`, persists to `apps.json`
   - `set_dnd`: Sets `config.dnd_enabled`, persists to `apps.json`
   - `should_send()`: Pure guard function extracted for unit testing (no AppHandle mock needed)

3. **Plugin + handler registration** (`lib.rs`): `tauri_plugin_notification::init()` added before setup; three new commands registered in `generate_handler!`.

4. **Capability scoping** (`shell-only.json`): `notification:default` scoped exclusively to `["main"]` window. `default.json` unchanged — app webviews (`app-*`) must not have notification plugin access.

5. **Init script intercept** (`commands/webview.rs`): `window.Notification` proxy added to `initialization_script` in `switch_app_impl`. Intercepts `new Notification(title, options)` calls and routes to `send_notification` via `__TAURI_INTERNALS__.invoke`. All JS wrapped in nested try/catch for resilience.

## Verification Results

- `cargo build`: clean, no warnings
- `cargo test`: 34 tests pass (7 new guard logic tests + 2 new config backward compat tests)
- `notification:default` present only in `shell-only.json` — confirmed via grep
- `default.json` unchanged — no notification permission added to `app-*` scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical fix] Prefixed unused `title` param with `_title`**
- **Found during:** Task 2 (build warning)
- **Issue:** `send_notification` receives `title` from JS (page title) but uses `app_name` as the OS notification title — `title` was unused
- **Fix:** Renamed to `_title` per Rust/project conventions for intentionally unused vars
- **Files modified:** `src-tauri/src/commands/notifications.rs`
- **Commit:** `6951494`

**2. [Rule 2 - Missing fields] Updated existing NexusConfig test structs with new fields**
- **Found during:** Task 1 (compile error)
- **Issue:** Existing tests constructing `NexusConfig` structs directly didn't include `muted_app_ids`/`dnd_enabled`
- **Fix:** Added the two new fields to two existing test struct literals
- **Files modified:** `src-tauri/src/config.rs`
- **Commit:** `8967ae7`

## Commits

| Hash | Message |
|------|---------|
| `8967ae7` | feat(06-01): add notification commands with config fields and guard logic |
| `6951494` | feat(06-01): register notification plugin, capabilities, and init script intercept |

## Self-Check

### Files
- `src-tauri/src/commands/notifications.rs` — exists
- `src-tauri/capabilities/shell-only.json` — exists
- `src-tauri/src/config.rs` — modified (muted_app_ids, dnd_enabled)
- `src-tauri/src/lib.rs` — modified (plugin + handler registration)
- `src-tauri/src/commands/webview.rs` — modified (Notification intercept)

### Commits
- `8967ae7` — exists
- `6951494` — exists

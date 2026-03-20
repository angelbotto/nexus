---
phase: 05-cross-platform-distribution
plan: 01
subsystem: rust-backend
tags: [cross-platform, cfg-guards, session-isolation, shortcuts, release-profile]
dependency_graph:
  requires: []
  provides: [cross-platform-rust-backend, platform-config-overrides]
  affects: [src-tauri/Cargo.toml, src-tauri/src/config.rs, src-tauri/src/routing.rs, src-tauri/src/commands/webview.rs, src-tauri/src/lib.rs, src-tauri/tauri.conf.json, src-tauri/tauri.windows.conf.json, src-tauri/tauri.linux.conf.json]
tech_stack:
  added: []
  patterns: [cfg-guards, platform-conditional-deps, target-specific-cargo-section, release-profile-lto]
key_files:
  created:
    - src-tauri/tauri.windows.conf.json
    - src-tauri/tauri.linux.conf.json
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/config.rs
    - src-tauri/src/routing.rs
    - src-tauri/src/commands/webview.rs
    - src-tauri/src/lib.rs
    - src-tauri/tauri.conf.json
decisions:
  - "platform_data_dir() uses #[allow(unused_variables, dead_code)] since the function is only called under #[cfg(not(target_os = \"macos\"))] — dead on macOS host, alive on Windows/Linux"
  - "cmd_modifier() replaces all Modifiers::SUPER hardcoded references — returns SUPER on macOS, CONTROL on Windows/Linux"
  - "GAP=0.0, GAP_TOP=12.0 on non-macOS for edge-to-edge webview with native title bar (no rounded corners needed)"
metrics:
  duration: 4 min
  completed: 2026-03-20
  tasks_completed: 2
  files_modified: 8
---

# Phase 5 Plan 1: Cross-Platform Rust Backend Summary

**One-liner:** Platform-conditional cfg guards throughout Rust backend: macOS-only objc2 deps, per-OS config/data paths, session isolation, Ctrl/Cmd modifier mapping, and release profile for binary size.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Platform-conditional Cargo deps, release profile, config path, session isolation, shortcut modifier | dbb66bd | Cargo.toml, config.rs, routing.rs, commands/webview.rs, lib.rs |
| 2 | Platform config overrides for window decorations | 4f4bd1b | tauri.conf.json, tauri.windows.conf.json, tauri.linux.conf.json |

## What Was Built

### Task 1: Rust Backend Cross-Platform Guards

**Cargo.toml:**
- Moved `objc2`, `objc2-quartz-core`, `objc2-app-kit` into `[target.'cfg(target_os = "macos")'.dependencies]`
- Added `[profile.release]` with `lto=true`, `strip=true`, `opt-level="s"`, `panic="abort"`, `codegen-units=1`

**config.rs:**
- Replaced single macOS `config_path()` with `#[cfg]`-branched implementation: `~/.nexus/apps.json` (macOS), `%APPDATA%/Nexus/apps.json` (Windows), `~/.config/nexus/apps.json` (Linux)
- Removed top-level `use dirs::home_dir;` import — now uses fully qualified `dirs::home_dir()` / `dirs::config_dir()` inline

**routing.rs:**
- Wrapped `make_store_id()` in `#[cfg(target_os = "macos")]` (returns `[u8; 16]` for WKWebView `data_store_identifier`)
- Added `platform_data_dir(app_id)` for Windows/Linux webview data directory paths
- Guarded `make_store_id` tests with `#[cfg(target_os = "macos")]`

**commands/webview.rs:**
- Removed top-level `make_store_id` import; uses `crate::routing::make_store_id()` under `#[cfg(target_os = "macos")]`
- Extracted `WebviewBuilder` chain into `let builder = ...` variable; applies `.data_store_identifier()` (macOS) or `.data_directory()` (Windows/Linux) via `#[cfg]` guards
- `GAP`: 12.0 (macOS floating card), 0.0 (Windows/Linux edge-to-edge)
- `GAP_TOP`: 40.0 (macOS traffic lights), 12.0 (Windows/Linux native title bar)

**lib.rs:**
- Added `cmd_modifier()` helper: `Modifiers::SUPER` on macOS, `Modifiers::CONTROL` on Windows/Linux
- All 5 shortcut comparisons (KeyN, KeyB, KeyK, KeyR, digit loop) use `cmd_modifier()`
- All 5 shortcut registrations use `cmd_modifier()`

### Task 2: Platform Config Overrides

**tauri.windows.conf.json** and **tauri.linux.conf.json**: JSON Merge Patch overrides setting `titleBarStyle: "Visible"`, `decorations: true`, `hiddenTitle: false` for native OS title bars.

**tauri.conf.json**: Added `"createUpdaterArtifacts": "v1Compatible"` to bundle config for Plan 02 updater integration.

## Verification Results

- `cargo check` passes clean (0 errors, 0 warnings)
- `cargo test` passes 25/25 tests
- `grep "objc2" Cargo.toml` shows entries only under `[target.'cfg(target_os = "macos")'.dependencies]`
- `grep "data_store_identifier" src/` shows only inside `#[cfg(target_os = "macos")]` block
- `grep "Modifiers::SUPER" src/` returns only `cmd_modifier()` function body behind `#[cfg(target_os = "macos")]`
- Platform override files exist and parse as valid JSON with `titleBarStyle: "Visible"`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness] Added #[allow(unused_variables, dead_code)] on platform_data_dir**
- **Found during:** Task 1 cargo check
- **Issue:** `platform_data_dir` is called only from `#[cfg(not(target_os = "macos"))]` blocks, so on macOS host it's dead code and its `app_id` parameter appears unused
- **Fix:** Added `#[allow(unused_variables, dead_code)]` attribute — the function IS used on Windows/Linux, the warnings are host-specific false positives
- **Files modified:** src-tauri/src/routing.rs
- **Commit:** dbb66bd

## Self-Check: PASSED

Files exist:
- src-tauri/Cargo.toml: FOUND
- src-tauri/src/config.rs: FOUND
- src-tauri/src/routing.rs: FOUND
- src-tauri/src/commands/webview.rs: FOUND
- src-tauri/src/lib.rs: FOUND
- src-tauri/tauri.conf.json: FOUND
- src-tauri/tauri.windows.conf.json: FOUND
- src-tauri/tauri.linux.conf.json: FOUND

Commits exist:
- dbb66bd: FOUND
- 4f4bd1b: FOUND

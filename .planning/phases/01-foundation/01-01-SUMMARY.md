---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [tauri2, rust, react, typescript, vite, tailwindcss, serde, serde_json, dirs, tempfile]

requires: []
provides:
  - Tauri 2 project scaffold (Rust + React 18 + TypeScript + Vite + Tailwind CSS v4)
  - NexusConfig/AppConfig/GroupConfig Rust structs with serde Serialize/Deserialize
  - load_or_create_config: reads ~/.nexus/apps.json, creates default on first-run, falls back on corrupt JSON
  - default_config: 4 apps (Plane/plane.botto.is, Linear, Gmail, GitHub) in 2 groups
  - AppState managed via Mutex<AppState> in Tauri setup
  - load_config IPC command exposed via generate_handler!
  - TypeScript types in src/types.ts mirroring Rust structs
  - Minimal React shell (App.tsx) invoking load_config on mount
  - 8 passing Rust unit tests for config module
affects:
  - 01-foundation-02 (file watcher + sidebar)
  - 01-foundation-03 (webview management uses AppState.webviews_created)
  - all future plans (IPC boundary shape established here)

tech-stack:
  added:
    - tauri 2.10.3
    - tauri-plugin-fs 2.4.5
    - tauri-plugin-opener 2.5.3
    - serde 1 + serde_json 1
    - dirs 5
    - uuid 1 (v4 feature)
    - md5 0.7
    - tempfile 3 (dev-dep)
    - react 18
    - typescript 5
    - vite 6
    - tailwindcss 4 + @tailwindcss/vite
    - @tauri-apps/api 2
    - @tauri-apps/plugin-fs 2
    - @tauri-apps/plugin-opener 2
  patterns:
    - Tauri AppState managed via Mutex<AppState> registered with app.manage()
    - IPC commands via #[tauri::command] + generate_handler! macro
    - Config loading with first-run creation and corrupt-JSON fallback
    - data_store_identifier (not data_directory) for macOS session isolation (used in Plan 02)
    - Tailwind CSS v4 via @tailwindcss/vite plugin, @import "tailwindcss" in CSS

key-files:
  created:
    - src-tauri/src/config.rs
    - src-tauri/src/state.rs
    - src-tauri/src/commands/config.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/main.rs
    - src-tauri/Cargo.toml
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src/types.ts
    - src/App.tsx
    - src/main.tsx
    - src/index.css
    - vite.config.ts
    - tsconfig.json
    - package.json
  modified: []

key-decisions:
  - "Use data_store_identifier([u8; 16]) for macOS session isolation, NOT data_directory (WKWebView limitation) — derive bytes via md5::compute(app_id) for determinism"
  - "All IPC flows through Rust commands (#[tauri::command]) — app webviews cannot call IPC directly due to CSP"
  - "Webviews NOT created at startup — lazy, on first click; tracked in AppState.webviews_created"
  - "Global shortcuts will be registered in Rust, not React — webviews steal keyboard focus"
  - "Config schema: id/name/url/group per app, separate groups section — enables Phase 2 group metadata without schema migration"

patterns-established:
  - "Pattern: Mutex<AppState> — all shared Rust state lives in Mutex managed via app.manage()"
  - "Pattern: IPC commands take State<'_, Mutex<AppState>> as parameter, lock it, return Result<T, String>"
  - "Pattern: Config fallback chain — read file -> parse JSON -> on error fallback to default_config()"
  - "Pattern: Rust structs with #[derive(Serialize, Deserialize, Clone, Debug, PartialEq)] mirror TS interfaces"

requirements-completed: [CONF-01, PLAT-01]

duration: 54min
completed: 2026-03-19
---

# Phase 1 Plan 1: Scaffold and Config Layer Summary

**Tauri 2 project scaffolded with React 18 + Vite + Tailwind CSS v4, Rust config module reading/creating ~/.nexus/apps.json with serde, AppState IPC boundary, and 8 passing unit tests**

## Performance

- **Duration:** 54 min
- **Started:** 2026-03-19T02:06:52Z
- **Completed:** 2026-03-19T03:01:09Z
- **Tasks:** 1 (TDD: RED + GREEN in single pass — tests written as part of implementation)
- **Files created:** 26

## Accomplishments

- Full Tauri 2 project scaffold from greenfield — Rust backend wired to React frontend
- Config module with first-run auto-creation: if `~/.nexus/apps.json` is missing it gets created with default 4 apps
- Corrupt/invalid JSON fallback: parse error falls back to default_config() silently — no crash
- 8 config unit tests all passing: serde round-trip, first-run creation, existing JSON reading, corrupt fallback, 4-app/2-group counts, plane.botto.is group placement, invalid group id tolerance
- `cargo build` succeeds on macOS arm64; `npm run build` succeeds with Tailwind CSS v4

## Task Commits

1. **Task 1: Scaffold Tauri 2 project and build config layer with tests** - `c5b8542` (feat)

## Files Created

- `src-tauri/src/config.rs` — NexusConfig/AppConfig/GroupConfig structs, config_path, default_config, load_or_create_config, 8 unit tests
- `src-tauri/src/state.rs` — AppState struct with config, active_app_id, webviews_created; AppState::new constructor
- `src-tauri/src/commands/config.rs` — load_config IPC command
- `src-tauri/src/commands/mod.rs` — re-exports commands::config
- `src-tauri/src/lib.rs` — Tauri builder: plugin registration, setup closure, generate_handler!
- `src-tauri/src/main.rs` — binary entry point calling nexus_lib::run()
- `src-tauri/Cargo.toml` — all Rust dependencies
- `src-tauri/build.rs` — tauri-build
- `src-tauri/tauri.conf.json` — app identifier is.botto.nexus, macOS minimumSystemVersion 14.0
- `src-tauri/capabilities/default.json` — fs, opener, core permissions
- `src-tauri/icons/` — placeholder RGBA PNG icons (32x32, 128x128, 128x128@2x), ICO, ICNS
- `src/types.ts` — TypeScript interfaces mirroring Rust structs
- `src/App.tsx` — minimal React shell, invokes load_config on mount, renders app list
- `src/main.tsx` — React entry point
- `src/index.css` — @import "tailwindcss" (v4 style)
- `vite.config.ts` — Vite config with @vitejs/plugin-react and @tailwindcss/vite
- `tsconfig.json` — strict TypeScript config
- `package.json` — all JS/TS dependencies
- `index.html` — Vite HTML entry
- `.gitignore` — ignores node_modules, dist, target, gen

## Decisions Made

- **data_store_identifier vs data_directory:** macOS WKWebView does not support `data_directory` for session isolation. `data_store_identifier([u8; 16])` is the correct macOS mechanism (requires macOS 14+, satisfied by all Apple Silicon Macs). Bytes derived via `md5::compute(app_id)` for determinism across restarts.
- **Icon format:** Tauri's `generate_context!()` macro validates icons at compile time and requires RGBA PNG. Created minimal valid RGBA placeholders (auto-fix: Rule 3 blocking).
- **Cargo.lock committed:** Committed for reproducible builds (binary project convention).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created RGBA icon placeholders**
- **Found during:** Task 1 (first cargo test run)
- **Issue:** `generate_context!()` macro panics at compile time if icon files are missing or non-RGBA
- **Fix:** Created valid minimal RGBA PNG icons (32x32, 128x128, 256x256), plus placeholder ICO and ICNS files
- **Files modified:** `src-tauri/icons/` (5 files)
- **Verification:** cargo build succeeds after fix
- **Committed in:** c5b8542 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for build to succeed. Placeholder icons are appropriate for MVP; final icons are out-of-scope for this plan.

## Issues Encountered

- `generate_context!()` validates icon files at compile time, not runtime — missing/wrong-format icons cause a Rust proc-macro panic that prevents running any tests. Fixed by creating valid RGBA PNG placeholders before proceeding.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Config layer is complete and tested — Plan 02 can build the file watcher and sidebar on top of this
- `AppState.webviews_created` is in place — Plan 02/03 will populate it on first webview creation
- `data_store_identifier` pattern is documented — Plan 02 must use `md5::compute(app_id).0` when creating WebviewWindows
- IPC boundary is established — all future commands follow the `State<'_, Mutex<AppState>>` pattern

---
*Phase: 01-foundation*
*Completed: 2026-03-19*

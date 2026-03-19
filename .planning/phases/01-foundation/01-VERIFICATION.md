---
phase: 01-foundation
verified: 2026-03-18T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 1: Foundation Verification Report

**Phase Goal:** A working Tauri 2 app with locked-in architecture — file-based config loads and saves, each app gets a session-isolated WebviewWindow, external links open in the system browser, and the IPC boundary between the React shell and Rust core is stable.
**Verified:** 2026-03-18
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App launches on macOS arm64 and displays a sidebar populated from `~/.nexus/apps.json` | VERIFIED | `load_or_create_config` in `lib.rs` setup closure; `Sidebar.tsx` renders `config.apps` list; tauri.conf.json sets `minimumSystemVersion: "14.0"` (arm64 baseline) |
| 2 | Clicking an app loads its URL in a WebviewWindow with isolated session (cookies for App A don't appear in App B) | VERIFIED | `switch_app` in `webview.rs` calls `.data_store_identifier(make_store_id(&app_id))` where `make_store_id` returns `md5::compute(app_id).0` — unique deterministic `[u8;16]` per app |
| 3 | Clicking an external link inside an app webview opens it in the system default browser | VERIFIED | `on_navigation` closure in `webview.rs` calls `app_handle_nav.opener().open_url()` before returning `false`; `on_new_window` closure does the same before returning `NewWindowResponse::Deny` |
| 4 | Restarting Nexus restores previous login state for each app (sessions persist across restarts) | VERIFIED | `data_store_identifier` is derived deterministically from `app_id` via md5 — same app always gets same `[u8;16]` store ID across process restarts; WKWebView persists session data to that store |
| 5 | Editing `~/.nexus/apps.json` externally causes sidebar to update without restarting | VERIFIED | `useAppsConfig.ts` calls `watch(configPath, handler, { delayMs: 300 })`; handler invokes `reload_config` then `setConfig`; `reload_config` command re-reads disk and updates `AppState.config` |

**Score:** 5/5 truths verified

---

### Required Artifacts

All artifacts verified at all three levels (exists, substantive, wired).

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `src-tauri/src/config.rs` | `NexusConfig`, `AppConfig`, `GroupConfig` structs; `load_or_create_config`; `default_config`; 8 unit tests | Yes | Yes | Yes — called in `lib.rs` setup closure | VERIFIED |
| `src-tauri/src/state.rs` | `AppState` with `config`, `active_app_id`, `webviews_created: HashSet<String>` | Yes | Yes | Yes — registered via `app.manage(Mutex::new(AppState::new(config)))` in `lib.rs` | VERIFIED |
| `src-tauri/src/commands/config.rs` | `load_config` IPC command; `reload_config` IPC command | Yes | Yes | Yes — both registered in `generate_handler!` in `lib.rs` | VERIFIED |
| `src-tauri/src/commands/webview.rs` | `switch_app` IPC command with lazy WebviewWindow creation, `data_store_identifier`, navigation guards | Yes | Yes | Yes — registered in `generate_handler!`; called from `useAppsConfig.ts` | VERIFIED |
| `src-tauri/src/routing.rs` | `extract_base_domain`, `is_subdomain_of`, `is_oauth_provider`, `make_store_id`; 13 unit tests | Yes | Yes | Yes — imported and used in `webview.rs` `on_navigation` + `on_new_window` closures | VERIFIED |
| `src/types.ts` | `AppConfig`, `GroupConfig`, `NexusConfig` TypeScript interfaces mirroring Rust structs | Yes | Yes | Yes — imported by `useAppsConfig.ts` and `Sidebar.tsx` | VERIFIED |
| `src/App.tsx` | Root component; uses `useAppsConfig`; renders `<Sidebar>`; layout flex row | Yes | Yes | Yes — renders sidebar and main area; wired to hook | VERIFIED |
| `src/hooks/useAppsConfig.ts` | Loads config via IPC; file watcher with 300ms debounce; tracks `activeAppId`; exposes `switchApp` | Yes | Yes | Yes — used in `App.tsx` | VERIFIED |
| `src/components/Sidebar.tsx` | Flat app list with Google Favicon API icons; active state highlight; click-to-switch | Yes | Yes | Yes — rendered in `App.tsx` with `config`, `activeAppId`, `switchApp` props | VERIFIED |

---

### Key Link Verification

All critical wiring chains verified.

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src-tauri/src/lib.rs` | `src-tauri/src/config.rs` | `config::load_or_create_config()` in `setup` closure | WIRED | Line 18: `let config = config::load_or_create_config();` |
| `src-tauri/src/lib.rs` | `src-tauri/src/commands/config.rs` | `generate_handler!` macro | WIRED | Lines 23-24: `commands::config::load_config`, `commands::config::reload_config` |
| `src-tauri/src/lib.rs` | `src-tauri/src/commands/webview.rs` | `generate_handler!` macro | WIRED | Line 25: `commands::webview::switch_app` |
| `src/components/Sidebar.tsx` | `src-tauri/src/commands/webview.rs` | `invoke('switch_app', { appId })` | WIRED | `useAppsConfig.ts` line 54: `await invoke("switch_app", { appId: id })` — called from `switchApp` prop |
| `src-tauri/src/commands/webview.rs` | `src-tauri/src/routing.rs` | `extract_base_domain` + `is_oauth_provider` in `on_navigation` closure | WIRED | `webview.rs` line 7: imports all four routing helpers; used in both `on_navigation` and `on_new_window` |
| `src-tauri/src/commands/webview.rs` | `src-tauri/src/state.rs` | `AppState.webviews_created` check before creating | WIRED | Line 18: `let already_created = st.webviews_created.contains(&app_id);` — guards against label collision |
| `src/hooks/useAppsConfig.ts` | `@tauri-apps/plugin-fs` | `watch()` on `~/.nexus/apps.json` with 300ms debounce | WIRED | Lines 30-41: `unwatchFn = await watch(configPath, async () => {...}, { delayMs: 300 })` |
| `src/hooks/useAppsConfig.ts` | `src-tauri/src/commands/config.rs` | `invoke('reload_config')` on watch event | WIRED | Line 34: `const updated = await invoke<NexusConfig>("reload_config")` |

---

### Requirements Coverage

All 7 requirement IDs declared across the three PLAN files are covered.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONF-01 | 01-01-PLAN.md | User can define apps in `~/.nexus/apps.json` with id, name, url, icon, and group fields | SATISFIED | `AppConfig` struct has `id`, `name`, `url`, `group`; `NexusConfig` has `apps: Vec<AppConfig>` + `groups: Vec<GroupConfig>`; `default_config()` creates file on first run |
| CONF-04 | 01-03-PLAN.md | App reads and watches `~/.nexus/apps.json` for external changes and reloads automatically | SATISFIED | `watch()` with `delayMs: 300` in `useAppsConfig.ts`; `reload_config` command re-reads disk and updates `AppState.config`; sidebar re-renders on state change |
| WEB-01 | 01-02-PLAN.md | Each app loads its URL in a dedicated webview | SATISFIED | `switch_app` creates `WebviewWindowBuilder::new(...)` with `WebviewUrl::External(url)` per app |
| WEB-05 | 01-02-PLAN.md | Sessions (cookies, login state) persist across app restarts | SATISFIED | `data_store_identifier(make_store_id(&app_id))` — deterministic md5 from app_id; WKWebView persists this store across process restarts |
| WEB-06 | 01-02-PLAN.md | Each app has isolated session storage (separate data directory) | SATISFIED | Each app gets a unique `[u8;16]` from `md5::compute(app_id)` — distinct stores per app |
| WEB-07 | 01-03-PLAN.md | External links (different domain) open in system default browser | SATISFIED | `on_navigation` closure: domain check → if external, `opener().open_url()` then `return false`; `on_new_window` closure: same logic → `NewWindowResponse::Deny` |
| PLAT-01 | 01-01-PLAN.md | App builds and runs on macOS arm64 | SATISFIED | `tauri.conf.json` bundle.macOS.minimumSystemVersion = "14.0"; 21 Rust tests pass; `cargo build` succeeds on arm64 per SUMMARY |

**Orphaned requirements check:** REQUIREMENTS.md Traceability table maps exactly CONF-01, CONF-04, WEB-01, WEB-05, WEB-06, WEB-07, PLAT-01 to Phase 1. No orphaned requirements found.

---

### Anti-Patterns Found

Scanned all modified/created files in the three plans.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| None | — | — | No TODO/FIXME/HACK/placeholder comments found; no empty implementations; no stub handlers |

No anti-patterns detected.

---

### Human Verification Required

The following behaviors were human-verified during Plan 03's checkpoint task (user typed "approved") and cannot be re-verified programmatically:

1. **Session isolation (visual)**
   - Test: Log into Gmail in its webview, switch to Linear, verify Google session is absent in Linear
   - Expected: Each webview shows its own independent login state
   - Why human: Session data lives in WKWebView's native store — not inspectable via grep

2. **External link routing (runtime)**
   - Test: Click a link to a different domain inside an app webview
   - Expected: System browser opens (Safari/Chrome), not a new webview within Nexus
   - Why human: The `on_navigation` closure fires at WKWebView runtime — requires live app

3. **Session persistence across restarts (runtime)**
   - Test: Log into Gmail, quit Nexus, relaunch, click Gmail again
   - Expected: Still logged in — no re-authentication required
   - Why human: Requires actual process restart and WKWebView data store persistence check

4. **Hot-reload timing (runtime)**
   - Test: Edit `~/.nexus/apps.json` in an external editor, save it
   - Expected: Sidebar updates within 1 second
   - Why human: Requires file system events and debounce timing to work end-to-end at runtime

All four were confirmed by user checkpoint approval during Plan 03 execution on 2026-03-19.

---

### Summary

Phase 1 goal is fully achieved. All five success criteria from ROADMAP.md are verifiable in the codebase:

- The config layer is complete and non-stub: `load_or_create_config` writes a real file on first run and falls back on corrupt JSON; `reload_config` updates live state without replacing good config on error; 8 unit tests cover the edge cases.
- Session isolation is correctly implemented using `data_store_identifier([u8;16])` derived via md5 from app ID — not `data_directory` (the macOS WKWebView limitation documented in RESEARCH.md), and not `[0;16]` (the hardcoded zero pitfall). IDs are deterministic across restarts.
- External link routing is fully wired: both `on_navigation` (returns `bool`) and `on_new_window` (returns `NewWindowResponse`) are set on every created webview, calling `opener().open_url()` before blocking. OAuth providers and subdomains are allowed through.
- The file watcher uses `watch()` with `delayMs: 300` and correctly registers an unwatch cleanup function on `useEffect` unmount.
- The IPC boundary is stable: all commands follow the `State<'_, Mutex<AppState>> → Result<T, String>` pattern; generate_handler! registers all three commands; no direct webview-to-IPC paths exist.
- 13 routing unit tests and 8 config unit tests (21 total) provide regression coverage for the irreversible architectural decisions.

No gaps, stubs, orphaned artifacts, or missing requirement coverage found.

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_

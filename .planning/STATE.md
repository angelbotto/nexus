---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 3 context gathered
last_updated: "2026-03-19T08:27:52.208Z"
last_activity: 2026-03-19 — Plan 02-01 complete (config schema extension + save_config + switch_app_impl)
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.
**Current focus:** Phase 2 — Instant Switching

## Current Position

Phase: 2 of 5 (Sidebar Navigation) — IN PROGRESS
Plan: 1 of 4 in phase — complete
Status: Phase 2 Plan 01 done, ready for Plan 02-02
Last activity: 2026-03-19 — Plan 02-01 complete (config schema extension + save_config + switch_app_impl)

Progress: [████░░░░░░] 57% (Phase 2 in progress — Plan 02-01 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 30 min
- Total execution time: 0.98 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 74 min | 25 min |
| 02-sidebar-navigation | 1 | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 54 min, 5 min, 15 min
- Trend: fast execution on well-scoped plans

*Updated after each plan completion*
| Phase 02-sidebar-navigation P02 | 8 | 2 tasks | 4 files |
| Phase 02-sidebar-navigation P03 | 3 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: Use `WebviewWindow` per app (not unstable `multiwebview` flag) — irreversible, must be set before any webview code
- [Phase 1]: Use `data_store_identifier([u8; 16])` NOT `data_directory` for macOS session isolation — WKWebView limitation confirmed in execution
- [Phase 1]: Derive data_store_identifier bytes via `md5::compute(app_id).0` — deterministic, survives restarts, avoids [0;16] crash
- [Phase 1]: All IPC flows through Rust backend (not from inside app webviews) — third-party CSP blocks `ipc.localhost`
- [Phase 1]: Global shortcuts registered in Rust, not React — app webviews steal keyboard focus from React
- [Plan 01-01]: Config schema: id/name/url/group per app + separate groups section — enables Phase 2 group metadata without schema migration
- [Plan 01-02]: extract_base_domain uses last-2-segments heuristic — sufficient for Phase 1; PSL library deferred to Phase 3+
- [Plan 01-02]: External URL handling in on_navigation calls opener before returning false — navigation cancel is immediate
- [Plan 01-03]: reload_config keeps existing AppState on corrupt JSON — prevents partial save from overwriting good config with defaults
- [Plan 01-03]: Frontend-owned file watcher (Option A): watch() in useEffect with 300ms debounce, invoke reload_config on event
- [Plan 01-03]: 300ms debounce absorbs atomic editor saves (temp file → rename) without flicker
- [Plan 02-01]: serde rename_all = "camelCase" on all config structs — JSON keys match TypeScript camelCase conventions (lastActiveAppId, sidebarCollapsed)
- [Plan 02-01]: switch_app_impl takes &AppHandle and &Mutex<AppState> (not State<>) — only signature compatible with both IPC and shortcut handler direct calls
- [Phase 02-02]: App.tsx owns local config state copy synced from useAppsConfig via useEffect — avoids modifying hook before Plan 02-03 handles watcher loop prevention
- [Phase 02-02]: groupApps() silently skips groups with no matching apps; Other bucket always rendered last with no header
- [Phase 02-02]: Tailwind v4 @theme block in index.css for custom sidebar color token (--color-sidebar: #111117)
- [Phase 02-sidebar-navigation]: shortcut.mods is Modifiers (not Option<Modifiers>) in tauri-plugin-global-shortcut v2.3.1 — direct equality, no Some() wrapping
- [Phase 02-sidebar-navigation]: configRef pattern: useRef<NexusConfig | null> provides always-current config inside event listener closures without re-registering
- [Phase 02-sidebar-navigation]: requestAnimationFrame for save_config after toggle: avoids async inside functional setState

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 RESOLVED]: `data_directory` does NOT work on macOS WKWebView — confirmed during Plan 01-01 research. Use `data_store_identifier([u8; 16])` instead. macOS 14+ required; all M1/M2/M3 Macs satisfy this.
- [Phase 3 research flag]: Badge dot via `evaluate_script` + MutationObserver on `<title>` — validate against Gmail, Linear, Slack before building (SPAs update title differently)
- [Phase 4 research flag]: `set_memory_usage_level(Low)` on Windows WebView2 real-world savings are unbenchmarked — measure against 500 MB budget during Phase 4

## Session Continuity

Last session: 2026-03-19T08:27:52.206Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-command-palette-config-management/03-CONTEXT.md

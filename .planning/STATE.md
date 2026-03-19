---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: "Completed 01-foundation-02-PLAN.md"
last_updated: "2026-03-19T03:09:13Z"
last_activity: "2026-03-19 — Executed plan 01-02: webview management + sidebar"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-19 — Plan 01-02 complete (webview management + sidebar)

Progress: [██████░░░░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 30 min
- Total execution time: 0.98 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 59 min | 30 min |

**Recent Trend:**
- Last 5 plans: 54 min, 5 min
- Trend: fast execution on well-scoped plans

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 RESOLVED]: `data_directory` does NOT work on macOS WKWebView — confirmed during Plan 01-01 research. Use `data_store_identifier([u8; 16])` instead. macOS 14+ required; all M1/M2/M3 Macs satisfy this.
- [Phase 3 research flag]: Badge dot via `evaluate_script` + MutationObserver on `<title>` — validate against Gmail, Linear, Slack before building (SPAs update title differently)
- [Phase 4 research flag]: `set_memory_usage_level(Low)` on Windows WebView2 real-world savings are unbenchmarked — measure against 500 MB budget during Phase 4

## Session Continuity

Last session: 2026-03-19T03:09:13Z
Stopped at: Completed 01-foundation-02-PLAN.md
Resume file: .planning/phases/01-foundation/01-03-PLAN.md

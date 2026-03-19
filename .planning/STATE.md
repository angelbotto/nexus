# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-18 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: Use `WebviewWindow` per app (not unstable `multiwebview` flag) — irreversible, must be set before any webview code
- [Phase 1]: Pass unique `data_directory` per app from first webview creation — retrofitting forces user logout
- [Phase 1]: All IPC flows through Rust backend (not from inside app webviews) — third-party CSP blocks `ipc.localhost`
- [Phase 1]: Global shortcuts registered in Rust, not React — app webviews steal keyboard focus from React

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 research flag]: `data_directory` session isolation behavior is platform-specific (macOS WKWebsiteDataStore vs Linux WebKitGTK vs Windows WebView2) — validate with minimal spike on all three platforms before committing to the pattern
- [Phase 3 research flag]: Badge dot via `evaluate_script` + MutationObserver on `<title>` — validate against Gmail, Linear, Slack before building (SPAs update title differently)
- [Phase 4 research flag]: `set_memory_usage_level(Low)` on Windows WebView2 real-world savings are unbenchmarked — measure against 500 MB budget during Phase 4

## Session Continuity

Last session: 2026-03-18
Stopped at: Roadmap created — ready to plan Phase 1
Resume file: None

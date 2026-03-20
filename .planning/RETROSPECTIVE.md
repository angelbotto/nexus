# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-20
**Phases:** 5 | **Plans:** 18 | **Commits:** 96

### What Was Built
- Tauri 2 desktop app with session-isolated webviews, lazy loading, LRU pool (8 max)
- Arc-inspired sidebar with groups, drag & drop, activity badges, collapsible toggle
- Command palette with fuzzy search, add/remove apps, quick actions
- Performance contract met: <1s startup, <100ms switching, <500MB RAM, 4.8MB binary
- Cross-platform: macOS universal, Linux .deb/.AppImage, Windows NSIS
- Auto-updater with GitHub Releases, non-blocking launch check, dismissible banner
- GitHub Actions CI/CD with 3-platform matrix and artifact size gate

### What Worked
- GSD phased approach: 5 phases with clear boundaries kept scope tight
- Human verification checkpoints caught real issues before marking phases complete
- Lazy webview creation was essentially free (already the default Tauri behavior)
- LRU anti-deadlock pattern (collect inside lock, close outside) prevented concurrency bugs
- Platform-specific config overrides (tauri.windows.conf.json) cleanly separated concerns

### What Was Inefficient
- Research agent assumed tauri-action@v1 existed (it's v0.6) — caused 2 CI failures before fix
- AppImage size (76MB) caught the size gate — had to exclude it since AppImage bundles webkit2gtk
- uploadUpdaterJson not a valid input in tauri-action@v0.6 — another research miss
- Some plan checkboxes in ROADMAP.md weren't updated by executors (cosmetic, didn't block)

### Patterns Established
- `#[cfg(target_os)]` guards for platform-specific Rust code (objc2, data_store_identifier)
- `cmd_modifier()` helper for Cmd→Ctrl mapping across platforms
- Rust→React bridge via `main_wv.eval("window.dispatchEvent(new CustomEvent(...))")`
- `configRef` pattern: useRef for always-current config in event listener closures
- Pure config mutation functions: NexusConfig in → NexusConfig out, no side effects

### Key Lessons
1. Always verify CI action version tags exist before writing workflows — use `gh api` to check
2. AppImage bundles the full runtime — size gates should exclude it or use a higher limit
3. Platform-native is better than custom: native title bars, native session isolation, native shortcuts
4. data_store_identifier is macOS-only — other platforms need data_directory with per-app paths

### Cost Observations
- Model mix: ~70% sonnet (agents), ~30% opus (orchestration)
- Total timeline: 2 days (2026-03-18 → 2026-03-20)
- Notable: well-scoped phases with 2-3 tasks each executed fast (~5-15 min per plan)

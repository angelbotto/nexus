# Project Research Summary

**Project:** Nexus — Tauri 2 unified web-app browser / desktop launcher
**Domain:** Multi-webview desktop application (web-app launcher with persistent sessions)
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

Nexus is a desktop application that acts as a unified launcher for web apps — think Station, Ferdium, or Wavebox, but built with Tauri 2 instead of Electron. The core value proposition is the combination of native webviews (no bundled Chromium), file-based JSON config, and Arc-quality UX aesthetics. Every competitor in this space uses Electron, so Tauri's native webview approach yields a binary under 10 MB and startup under 1 second — genuine differentiators, not marketing claims. The recommended architecture is a React shell WebView (sidebar + command palette) paired with per-app hidden `WebviewWindow` instances managed via an LRU pool from Rust.

The critical architectural decision that must be made in Phase 1 is to use `WebviewWindow` per app tab (stable) rather than the `multiwebview` in-window API (explicitly unstable, open bugs on all three platforms). Everything else flows from this: session isolation requires a `data_directory` per app, global shortcuts must be registered in Rust rather than React (app webviews steal keyboard focus), and Tauri IPC must not be called from inside app webviews (third-party CSP headers block it). These are not optional refinements — skipping any of them produces bugs that require architectural rewrites to fix.

The main risk is scope creep. The competitor landscape clearly shows which features are necessary (sidebar, lazy loading, persistent sessions, file config, keyboard shortcuts, command palette) and which should be deferred (multi-account, spaces/profiles, native notifications, extension support). Extension support is architecturally incompatible with Tauri's native-webview model and should never be attempted in v1. The file-based JSON config is Nexus's most distinctive differentiator — no competitor does this — and it is also the foundation that every other feature depends on. Build that first.

## Key Findings

### Recommended Stack

The stack is Tauri 2 + React 19 + TypeScript (strict) + Vite + Tailwind v4, with Zustand for UI state and dnd-kit for drag-and-drop. This is the de-facto 2026 Tauri community stack, confirmed by multiple production templates. The only non-obvious call is explicitly avoiding `react-beautiful-dnd` (abandoned, no React 19 support) and `localStorage` for config persistence (confirmed cross-platform bug in Tauri when multiple WebviewWindows are open). Config persistence goes through Rust via `@tauri-apps/plugin-fs` and `serde_json`.

**Core technologies:**
- Tauri 2.10.3: Desktop runtime with native webviews — no bundled Chromium, binary under 10 MB, sub-1s startup
- React 19 + TypeScript: UI shell (sidebar, command palette); constraint from PROJECT.md; concurrent mode keeps sidebar responsive during webview switches
- Vite 8 + Tailwind v4: Build tooling; Vite 8 ships Rolldown (Rust bundler, 10-30x faster builds); Tailwind v4 is CSS-first, stable since Jan 2025
- Zustand 5: Global UI state (active app, sidebar collapsed, app order) — three-layer pattern: useState → Zustand → Tauri IPC
- dnd-kit: Drag-and-drop sidebar reorder — use pointer/mouse sensors, not HTML5 drag (known Tauri WebKit issues)
- cmdk (via shadcn Command): Command palette — powers Linear, Raycast, zero-effort styling via shadcn/ui
- `@tauri-apps/plugin-fs` + serde: Config persistence; direct fs + serde_json preferred over tauri-plugin-store for full schema control

**Version notes:** Keep Tauri Rust crate and JS API at matching minor versions. Vite 8 is very new as of Mar 2026 — pin to Vite 7 if the React plugin ecosystem lags.

### Expected Features

Competitor analysis (Station, Wavebox, Ferdium, Shift, Rambox, WebCatalog) confirms clear expectations. All Electron-based competitors are slow and RAM-heavy — Nexus's speed and memory claims are credible only if lazy loading and the LRU webview pool are implemented. The file-based config is the only feature no competitor has.

**Must have (table stakes):**
- Sidebar navigation with app icons and groups — the universal paradigm across all competitors
- Persistent sessions across restarts — the #1 reason users choose this over a browser bookmark
- Lazy loading / sleep for inactive apps — without this, 5+ apps blow past 500 MB RAM
- File-based config (`~/.nexus/apps.json`) — the foundation; hardcoded list is not a product
- Keyboard shortcuts (Cmd+1..9, Cmd+R, Cmd+B) — power users require this; missing = won't adopt
- External links open in system browser — missing this makes Nexus a broken general browser
- Command palette (Cmd+K) — table stakes once you have more than 5 apps
- Cross-platform: macOS arm64/intel, Linux, Windows

**Should have (competitive):**
- Drag-and-drop sidebar reorder — users need to curate order; feels unfinished without it
- Activity badge (title-change dot) — silent notification differentiates Nexus from browser bookmarks
- Dark mode + minimal Arc-inspired aesthetic — competitive bar is high; first impression matters
- Collapsible sidebar (Cmd+B) — low cost, high payoff for focused work

**Defer (v2+):**
- Spaces / profiles — massive state complexity; validate single-workspace first
- Multi-account support — partitioned sessions; Wavebox's most complex feature
- Native OS notifications — notification fatigue risk; requires careful per-app opt-in architecture
- Smooth animations / transitions — ship correctness before aesthetics
- Extension support — architecturally incompatible with native webviews; would require abandoning Tauri

### Architecture Approach

The architecture is a two-process model: a permanent React shell WebView (sidebar + command palette) communicates with a Rust core process via Tauri IPC. App webviews are separate `WebviewWindow` instances (stable API) managed by a Rust-owned `WebviewRegistry` with LRU eviction. React never directly manages webview lifecycle — all create/show/hide/destroy calls go through Rust commands. Global shortcuts are registered in Rust (not React) so they fire even when an app webview has keyboard focus.

**Major components:**
1. Shell WebView (React) — sidebar, command palette, drag-drop reorder; never navigates to external URLs; communicates exclusively via `invoke()` and `listen()`
2. Rust Core — command handlers (`load_config`, `save_config`, `create_app_webview`, `switch_to_app`, `destroy_webview`), WebviewRegistry with LRU pool, config file watcher
3. WebviewRegistry — `Mutex<HashMap<String, WebviewEntry>>` with `VecDeque` for LRU order; owns webview lifecycle; enforces pool size (default N=5)
4. AppsConfig — `Mutex<AppsConfig>` loaded from `~/.nexus/apps.json` at startup; surfaced to frontend via commands; watched for external edits via `notify` crate
5. GlobalShortcutPlugin — registers Cmd+K, Cmd+1..9, Cmd+B, Cmd+R at OS level; emits named events to shell WebView

**Build order from architecture:** Config layer → Shell/Sidebar → WebView lifecycle → LRU pool → Global shortcuts → Command palette → Badge dots → Drag-and-drop

### Critical Pitfalls

1. **`multiwebview` unstable flag has open bugs on all platforms** — use `WebviewWindow` per tab (stable) instead; one OS window per app, `visible(false)` initially, `show()`/`hide()` to swap. Decide this in Phase 1 before writing any webview code.

2. **Session data shared across all webviews by default** — pass a unique `data_directory` path (`~/.nexus/profiles/<app-id>/`) to every `WebviewWindowBuilder`. This must be set from the first webview; retrofitting causes a one-time forced logout for existing users.

3. **Tauri IPC blocked by third-party CSP headers** — do not call `invoke()` from inside app webviews. App webviews load external sites whose CSP refuses `ipc.localhost`. All IPC must flow through the Rust backend, which emits events to the shell.

4. **`window.open()` / OAuth popups blocked by default since Tauri 2.3.0** — register an `on_new_window` Rust handler for every app `WebviewWindowBuilder` that allows known OAuth domains and routes everything else to `shell::open()`. Test every app's auth flow explicitly.

5. **Destroying webviews does not reliably free memory** — use a hide/show pool strategy instead of destroy/recreate. On Windows, call `set_memory_usage_level(Low)` on hidden webviews. Do not treat `close()` as a memory guarantee.

6. **Linux WebKitGTK version fragmentation** — build Linux artifacts in a Docker container pinned to Ubuntu 22.04. The binary built on Ubuntu 24.04 will not run on 22.04 users.

## Implications for Roadmap

Architecture research documents a clear build order with hard dependencies. Phase structure follows those dependencies directly.

### Phase 1: Foundation — Config, Shell, and Core Architecture

**Rationale:** Everything depends on having a stable config schema and a working webview architecture. The multiwebview/WebviewWindow decision, session isolation, and IPC design must be locked in before any feature work. These are irreversible architectural choices — wrong decisions here require rewrites.
**Delivers:** Working Tauri 2 app scaffold; `~/.nexus/apps.json` with load/save commands; React shell with Zustand store; sidebar rendering the app list; `WebviewWindow` per app with `data_directory` isolation; IPC boundary defined and tested; `on_new_window` handler registered; no multiwebview flag enabled.
**Addresses:** Persistent sessions, file-based config, external links to system browser
**Avoids:** Pitfalls 1 (multiwebview), 2 (session isolation), 3 (IPC/CSP), 4 (OAuth popups)
**Research flag:** Needs phase research — webview session isolation across all three platforms has platform-specific behavior; verify `data_directory` effectiveness on macOS, Linux, and Windows before committing to the pattern.

### Phase 2: Core UX — Sidebar, Navigation, and Keyboard Control

**Rationale:** With a working config and webview foundation, the primary user-facing surface can be built. Sidebar navigation, keyboard shortcuts, and command palette are the core interaction model — the app has no UX without these.
**Delivers:** Full sidebar with app icons, active indicator, and collapsible groups; Cmd+1..9 switching via global shortcut plugin; Cmd+R reload; Cmd+B collapse; command palette (Cmd+K) with fuzzy search; drag-and-drop reorder with apps.json write-back; dark mode.
**Implements:** GlobalShortcutPlugin, Zustand store slices, CommandPalette component, dnd-kit sortable sidebar
**Avoids:** Pitfall (keyboard shortcuts in React only — use global shortcut plugin so shortcuts work when app webview has focus)
**Research flag:** Standard patterns — shadcn/ui Command + cmdk is well-documented; dnd-kit sortable is well-documented. No phase research needed.

### Phase 3: Performance — Lazy Loading, LRU Pool, and Activity Badges

**Rationale:** Once the core UX works, the performance claims (sub-1s startup, under 500 MB RAM) need to be delivered and validated. Lazy loading and the LRU pool are the mechanisms that make both claims possible. Activity badges depend on the webview lifecycle being stable.
**Delivers:** Lazy webview creation (first click only, not startup); LRU pool (N=5 default, configurable); loading indicator while webview initializes; hide/show pool strategy (not destroy/recreate); `set_memory_usage_level(Low)` on hidden webviews (Windows); activity badge dot via title MutationObserver injected via `webview.evaluate_script()`; RAM profiling validation (target: under 500 MB with 10 tabs).
**Implements:** WebviewRegistry with LRU eviction, performance benchmarks
**Avoids:** Pitfall 5 (destroy does not free memory), performance trap (eager loading all apps on startup)
**Research flag:** Needs phase research — `set_memory_usage_level` API on Windows WebView2 and title MutationObserver injection via `evaluate_script` are sparsely documented; validate both against target apps (Gmail, Slack, Notion) before committing.

### Phase 4: Polish and Cross-Platform Distribution

**Rationale:** Once features are stable, cross-platform distribution and UX polish can be finalized. Linux packaging is a known landmine that requires a dedicated CI environment. This phase also catches the "looks done but isn't" items from the pitfalls checklist.
**Delivers:** Linux Docker build on Ubuntu 22.04 base; `.deb` and `.AppImage` tested on Ubuntu 22.04 and Fedora 39+; macOS universal binary (arm64 + intel); Windows NSIS installer; loading skeleton/spinner on webview init; window resize propagation to hidden webviews; end-to-end auth flow validation for Google/GitHub OAuth on each target app.
**Avoids:** Pitfall 6 (Linux WebKitGTK fragmentation), UX pitfall (blank white screen on first load), UX pitfall (resize breaks hidden webviews)
**Research flag:** Standard patterns for macOS/Windows packaging; Linux CI setup in Docker needs phase research if the team lacks Tauri Linux build experience.

### Phase Ordering Rationale

- Config layer is first because app groups, drag-and-drop, add/remove, and future features all read/write the same JSON schema. Getting the schema right before building consumers avoids painful migrations.
- Session isolation and IPC architecture are Phase 1 work because they are architectural decisions — retrofitting them requires touching every webview instantiation site.
- Keyboard shortcuts are Phase 2 (not Phase 1) because they depend on the sidebar and webview switching being functional, but they should be built before the command palette (which they trigger).
- LRU pool is Phase 3 because it is safe to build without it first (just keep all webviews alive), then add eviction in a later pass when the lifecycle is understood.
- Linux packaging is Phase 4 because it requires a stable binary — attempting cross-platform CI before the app builds cleanly on the dev machine is premature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Session isolation via `data_directory` has platform-specific behavior across macOS (WKWebsiteDataStore), Linux (WebKitGTK), and Windows (WebView2). Research the exact path semantics and verify that per-app isolation actually works on all three before writing the webview builder code.
- **Phase 3:** Badge dot implementation via `evaluate_script` + MutationObserver on `<title>` — validate against real-world SPAs that update document.title via `history.pushState` (Gmail, Linear, Notion behave differently). Also validate `set_memory_usage_level(Low)` on Windows WebView2.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Sidebar, command palette, dnd-kit, zustand, global shortcuts — all well-documented patterns with official Tauri plugin support and community templates.
- **Phase 4:** macOS and Windows packaging are standard Tauri build outputs; no surprises expected.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified against official release pages, version compatibility confirmed, alternatives evaluated with clear rationale |
| Features | HIGH | Based on direct analysis of 6+ competitors (Station, Wavebox, Ferdium, Shift, Rambox, WebCatalog); MVP feature set well-validated |
| Architecture | MEDIUM | `WebviewWindow` stable approach is well-documented; `data_directory` session isolation verified in principle but platform-specific behavior needs hands-on validation |
| Pitfalls | HIGH | Sourced from confirmed GitHub issues with issue numbers, not speculation; recovery strategies are actionable |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Session isolation platform parity:** `data_directory` behavior on macOS vs Linux vs Windows is documented inconsistently in Tauri issues. Validate with a minimal spike on all three platforms in Phase 1 before the full config layer is built.
- **Badge dot via `evaluate_script`:** MutationObserver injection via `webview.evaluate_script()` is the correct approach but sparse in Tauri docs. Validate against Gmail (count in title), Linear (SPA routing), and Slack (custom title updates) before building the badge system in Phase 3.
- **Windows WebView2 `set_memory_usage_level`:** API exists (wry 0.35.0), but real-world memory savings with actual web apps are not benchmarked in public sources. Measure against the 500 MB budget during Phase 3 validation.
- **Startup time validation:** The sub-1s claim requires lazy webview creation. Measure cold start on all three platforms after Phase 1 to confirm the baseline before lazy loading is added in Phase 3.

## Sources

### Primary (HIGH confidence)
- https://v2.tauri.app/ — Tauri 2 stable release notes, API reference, plugin docs, architecture concepts
- https://v2.tauri.app/blog/tauri-20/ — `multiwebview` unstable flag confirmed
- https://github.com/tauri-apps/tauri/issues — Direct issue evidence for pitfalls (#10131, #10420, #11376, #13071, #12568, #14263, #8476, #11491, #5397, #9662, #10314)
- https://react.dev/versions — React 19.2.1 stable confirmed
- https://tailwindcss.com/blog/tailwindcss-v4 — Tailwind v4 stable Jan 2025

### Secondary (MEDIUM confidence)
- Station, Wavebox, Ferdium, Shift, Rambox, WebCatalog — feature pages and GitHub repos for competitor analysis
- https://github.com/pmndrs/zustand/releases — Zustand 5.0.8 latest stable
- Community Tauri templates (dannysmith/tauri-template, ZingerLittleBee/tauri-react-template) — confirming de-facto 2025/2026 stack
- WebSearch results for dnd-kit + Tauri WebKit drag events — pointer sensor recommendation

### Tertiary (LOW confidence)
- Memory benchmarks for WKWebView per-instance RAM (~50-150 MB) — general WebKit guidance, not Tauri-specific measurement
- `set_memory_usage_level(Low)` real-world savings — documented API, unsourced benchmarks

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*

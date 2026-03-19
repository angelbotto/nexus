# Stack Research

**Domain:** Tauri 2 desktop browser / multi-webview unified web-app launcher
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH (core stack HIGH; multiwebview architecture MEDIUM due to unstable flag caveats)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.10.3 | Desktop runtime, native webviews, Rust backend | Native WebKit/WebView2 per-platform — no bundled Chromium, binary <10 MB, startup < 1s. v2 is stable (released Oct 2024, actively maintained at 2.10.x as of Mar 2026). |
| React | 19.2.1 | UI shell (sidebar, command palette, chrome) | Constraint from PROJECT.md. React 19 is the stable baseline; concurrent features help keep sidebar snappy during webview switching. |
| TypeScript | 5.x (Vite-bundled) | Type safety across JS/TS boundary | PROJECT.md constraint. Strict mode eliminates entire classes of runtime errors at the IPC boundary. |
| Vite | 8.x (latest) | Frontend build, HMR in dev | Official Tauri 2 frontend bundler. v8 ships Rolldown (Rust bundler), 10-30x faster builds vs v7. Use `@vitejs/plugin-react` for React. |
| Tailwind CSS | 4.2.x | Styling | CSS-first config, no JS config file, Vite plugin integration. Full v4 + React 19 support confirmed. Shadcn/ui components updated for v4. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api` | 2.10.1 | Core Tauri JS/TS API (webview, window, events, IPC) | Always — this is the official Tauri frontend SDK. |
| `@tauri-apps/plugin-fs` | 2.x | File read/write for `~/.nexus/apps.json` | For all config persistence. Use `BaseDirectory.Home` to resolve `~` cross-platform in the JS layer. |
| `@tauri-apps/plugin-opener` | 2.x | Open external links in system default browser | Use instead of deprecated `plugin-shell` for `openUrl()`. Required for the "external links → system browser" feature. |
| `zustand` | 5.0.8 | Global UI state (active app, sidebar collapse state, drag in progress) | Lightweight (< 1 KB), no boilerplate, works with React 19 concurrent mode. Three-layer pattern: `useState` for component state → `zustand` for global UI state → Tauri IPC for persistent state. |
| `@dnd-kit/core` + `@dnd-kit/sortable` | latest | Drag & drop sidebar reorder | dnd-kit is the successor to react-beautiful-dnd (which is unmaintained). Modular, accessible, works in Tauri's WebKit context. Note: raw HTML5 `draggable` attribute has known issues in Tauri — use dnd-kit's pointer/mouse sensors instead. |
| `cmdk` | latest | Command palette (Cmd+K) | Powers Linear, Raycast, Vercel — unstyled and composable. Pair with shadcn/ui `Command` component (which wraps cmdk) for zero-effort styling. |
| `fuse.js` | 7.x | Fuzzy search for command palette app list | cmdk has basic scoring; add Fuse.js for better fuzzy matching on app names/URLs when list grows. Only add if cmdk's built-in filtering is insufficient (>20 apps). |
| `serde` + `serde_json` | 1.x (Rust) | JSON serialization of `AppConfig` on Rust side | Standard. Use `#[derive(Serialize, Deserialize)]` on config structs. Pair with `tokio::fs` for async reads. |
| `tokio` | 1.x (Rust, via Tauri) | Async runtime for Rust commands | Tauri ships tokio; mark commands `async fn` to get it. Use `tokio::fs` for config file I/O to avoid blocking the main thread. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `create-tauri-app` | Project scaffolding | Run `npm create tauri-app@latest`, select React + TypeScript + Vite. Generates correct `src-tauri/` structure, `tauri.conf.json`, and `Cargo.toml`. |
| `@tauri-apps/cli` | `tauri dev` / `tauri build` | Install as devDependency. Use `tauri dev` for hot-reload (Vite + Rust rebuild). |
| Rust + Cargo | Rust backend compilation | Install via `rustup`. Tauri 2 requires Rust stable (1.77+). Use `cargo` directly only for dependency management; `tauri build` handles the rest. |
| shadcn/ui (CLI) | Component scaffolding | `npx shadcn@latest init` then `add command` for the palette, `add scroll-area` for sidebar. Generates unstyled base components you own — not a runtime dependency. |
| Vitest | Unit tests | Co-locate `.test.ts` files. Use for testing config parsing, IPC command logic, sidebar state reducers. |
| `@tauri-apps/plugin-devtools` | Dev-only webview inspector | Enables right-click → Inspect on webviews in dev mode. Remove from release capabilities. |

---

## Installation

```bash
# Scaffold
npm create tauri-app@latest nexus -- --template react-ts

# Frontend dependencies
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities cmdk

# Tauri plugins (JS side)
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-opener

# UI (shadcn wraps cmdk — use either/or, not both)
npx shadcn@latest init
npx shadcn@latest add command scroll-area

# Dev dependencies
npm install -D @tauri-apps/cli vitest @testing-library/react

# Tailwind v4 with Vite plugin
npm install tailwindcss @tailwindcss/vite
```

```toml
# src-tauri/Cargo.toml — add to [dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

**Note on `multiwebview` unstable flag:** Do NOT add `features = ["unstable"]` to the tauri dependency for v1 of Nexus. Use `WebviewWindow` (separate OS windows, one per app) instead. See Architecture Patterns below.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `WebviewWindow` (one OS window per app, show/hide) | `multiwebview` unstable (multiple webviews embedded in one window) | Only when `multiwebview` graduates to stable. Currently has rendering bugs on Linux, z-order issues on Windows, and broken positioning — do not ship in v1. |
| Tauri 2 | Electron | Only if you need guaranteed CSS/JS parity across platforms. Electron bundles Chromium (~150 MB overhead); Tauri uses native webviews (~3-10 MB binary). For Nexus's RAM target (<500 MB with 10 webviews), Tauri is the correct choice. |
| Zustand | Redux Toolkit | Only for apps with complex server-side state synchronization. Redux adds significant boilerplate for what Nexus needs (sidebar state + active app index). |
| Zustand | Jotai | Jotai's atomic model is better for fine-grained reactivity. Zustand's slice pattern fits Nexus better (one store, multiple slices: `sidebarStore`, `webviewStore`). |
| dnd-kit | react-beautiful-dnd | Never — rbd is abandoned (Atlassian deprecated it in 2022, no React 19 support). |
| dnd-kit | HTML5 native drag | Tauri WebKit has known issues with native HTML5 drag events (pointer events not firing correctly). Use dnd-kit's pointer/mouse sensor to bypass. |
| `@tauri-apps/plugin-fs` + `serde_json` | `tauri-plugin-store` | Use plugin-store if you need reactive key-value persistence with auto-save. For Nexus's simple `~/.nexus/apps.json` config, direct fs + serde_json gives you full control over schema and avoids an extra abstraction layer. |
| `@tauri-apps/plugin-opener` | `@tauri-apps/plugin-shell` | plugin-shell's `open()` is deprecated in Tauri 2 — plugin-opener is the official replacement. |
| cmdk (via shadcn Command) | kbar | kbar adds Fuse.js dependency and more complex registration API. cmdk is simpler for Nexus's static app list. |
| Tailwind v4 | Tailwind v3 | v3 is EOL-approaching. v4 is stable since Jan 2025, and all shadcn/ui components are updated for it. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tauri = { features = ["unstable"] }` | `multiwebview` (embedded webviews in one window) has open bugs: only last child renders on some platforms, positioning broken on Linux, z-order wrong on Windows. Still flagged unstable in v2.10.x. | `WebviewWindow` (one OS window per app, toggled visible/hidden via `show()`/`hide()`) — stable, fully supported. |
| `react-beautiful-dnd` | Abandoned. No React 19 support. Last release 2022. | `@dnd-kit/sortable` |
| `localStorage` for config persistence | localStorage is not synced between multiple WebviewWindows in Tauri on Linux (confirmed bug #10981). Cookies/session storage within third-party app webviews work fine; don't use localStorage for Nexus's own config. | `@tauri-apps/plugin-fs` to write `~/.nexus/apps.json` from Rust commands |
| `@tauri-apps/plugin-shell` (for `open()`) | Deprecated in Tauri 2 for URL opening. Still works but plugin-opener is the recommended path. | `@tauri-apps/plugin-opener` |
| Electron | ~150 MB binary, high baseline RAM from bundled Chromium, slow startup. Contradicts Nexus's < 1s startup and < 500 MB RAM goals. | Tauri 2 |
| CSS animations/transitions on webview switching | Each `WebviewWindow` is a native OS window — CSS in the React shell cannot animate the webview content area. V1 explicitly defers smooth animations. | Native window `show()`/`hide()` (instant, no animation) — polish in v2 |

---

## Stack Patterns by Variant

**Multi-webview architecture (WebviewWindow approach — use this for v1):**
- Each web app gets its own `WebviewWindow` with a unique label (`app-${id}`)
- On app switch: call `activeWindow.hide()` then `targetWindow.show()`
- Lazy loading: create `WebviewWindow` on first activation; destroy if LRU cache exceeds N=5 recently-used apps
- Session persistence: WebKit/WebView2 stores cookies/credentials per webview automatically when `dataDirectory` is set in `WebviewWindowBuilder` — no extra work needed

**Sidebar UI (React shell in main window):**
- The React app runs in the main `WebviewWindow` (the sidebar chrome)
- App webviews are separate OS windows; they appear to float "inside" the main window by matching their bounds to the content area — or use a frameless main window approach
- Use `zustand` to track `activeAppId`, `sidebarCollapsed`, `appOrder` in the React shell
- Write config back to `~/.nexus/apps.json` via Tauri IPC command on every mutation

**Config file pattern (Rust side):**
- Define `AppConfig` struct with `#[derive(Serialize, Deserialize)]`
- Expose `#[tauri::command] async fn load_config(app: AppHandle) -> Result<AppConfig, String>` and `save_config`
- Use `app.path().home_dir()` to resolve `~` — avoids hardcoding paths cross-platform

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `tauri@2.10.3` | `@tauri-apps/api@2.10.1` | Always keep tauri Rust crate and JS API package at matching minor versions. |
| React 19 | `@dnd-kit/*` latest | dnd-kit fully supports React 19 concurrent mode. |
| React 19 | `zustand@5.x` | Zustand 5 explicitly supports React 19 and concurrent mode. |
| Tailwind v4 | shadcn/ui (latest CLI) | shadcn/ui components are updated for v4; use `npx shadcn@latest` not older `npx shadcn-ui@latest`. |
| Vite 8 | `@vitejs/plugin-react` (latest) | Verify plugin supports Vite 8 before upgrading; as of Mar 2026 Vite 8 is very new — can pin to Vite 7 if plugin ecosystem lags. |
| `tauri-plugin-fs@2` | Tauri `2.x` | Plugin major version must match Tauri major version. |
| `tauri-plugin-opener@2` | Tauri `2.x` | Same versioning rule. |

---

## Sources

- https://v2.tauri.app/release/ — Confirmed tauri@2.10.3, @tauri-apps/api@2.10.1, wry@0.54.3 as latest stable (HIGH confidence)
- https://v2.tauri.app/blog/tauri-20/ — Confirmed `multiwebview` is behind `unstable` feature flag (HIGH confidence)
- https://v2.tauri.app/reference/javascript/api/namespacewebview/ — Confirmed `hide()`, `show()`, `setPosition()`, `setSize()` are stable APIs on `Webview` class (HIGH confidence)
- https://v2.tauri.app/plugin/file-system/ — Confirmed `tauri-plugin-fs` + `BaseDirectory.Home` pattern (HIGH confidence)
- https://v2.tauri.app/plugin/opener/ — Confirmed `plugin-opener` as replacement for `plugin-shell.open()` (HIGH confidence)
- https://github.com/tauri-apps/tauri/blob/dev/examples/multiwebview/README.md — Confirms `--features unstable` required for multiwebview (HIGH confidence)
- GitHub issues #10011, #10420, #11170, #11376, #13071 — Multiple open bugs in multiwebview: rendering only last child, broken positioning on Linux, z-order on Windows (HIGH confidence — direct issue evidence)
- https://github.com/tauri-apps/tauri/issues/10981 — localStorage not syncing between multiple WebviewWindows on Linux (HIGH confidence)
- https://react.dev/versions — React 19.2.1 confirmed stable (HIGH confidence)
- https://tailwindcss.com/blog/tailwindcss-v4 — Tailwind v4 stable Jan 2025, v4.2 current (HIGH confidence)
- https://github.com/pmndrs/zustand/releases — Zustand 5.0.8 latest stable (MEDIUM confidence — GitHub releases page)
- WebSearch results for dnd-kit React 19 + Tauri drag events — dnd-kit pointer sensor recommended over HTML5 drag in Tauri (MEDIUM confidence — community patterns)
- https://github.com/dannysmith/tauri-template, https://github.com/ZingerLittleBee/tauri-react-template — Community templates confirming Tauri 2 + React 19 + Vite + Zustand + shadcn/ui as de-facto 2025 stack (MEDIUM confidence)

---

*Stack research for: Nexus — Tauri 2 unified web-app browser*
*Researched: 2026-03-18*

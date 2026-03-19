# Architecture Research

**Domain:** Tauri 2 multi-webview desktop browser app
**Researched:** 2026-03-18
**Confidence:** MEDIUM (multi-webview in single window is still `unstable` feature flag; per-window approach is stable and recommended)

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        OS Window (TAO)                             │
│                                                                    │
│  ┌────────────────┐  ┌──────────────────────────────────────────┐  │
│  │  Shell WebView │  │         App WebViews (WRY)               │  │
│  │  (React UI)    │  │                                          │  │
│  │                │  │  ┌──────────┐  ┌──────────┐             │  │
│  │  - Sidebar     │  │  │ WebView  │  │ WebView  │  (hidden)   │  │
│  │  - Cmd Palette │  │  │ gmail    │  │ slack    │  ...        │  │
│  │  - App State   │  │  │ (active) │  │ (cached) │             │  │
│  └───────┬────────┘  └──────────────────────────────────────────┘  │
│          │ IPC (invoke/emit)                                        │
├──────────┼─────────────────────────────────────────────────────────┤
│          │           Tauri Core Process (Rust)                      │
│  ┌───────▼──────────────────────────────────────────────────────┐  │
│  │                    Command Handlers                           │  │
│  │  load_config │ save_config │ create_webview │ switch_app      │  │
│  │  destroy_webview │ reload_webview │ get_all_webviews          │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                     App State (Mutex<T>)                      │  │
│  │  AppsConfig  │  WebviewRegistry  │  ActiveAppLabel            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Shell WebView | React app: sidebar, command palette, app-switch UI. Never navigates to external URLs. | `WebviewWindow` (main, stable) |
| App WebViews | Each loads one web app URL. Created on first visit, destroyed when evicted from LRU cache. | `Webview` child of shell window (unstable) OR `WebviewWindow` hidden (stable workaround) |
| WebviewRegistry | Rust-side map of `label -> WebviewHandle`. Tracks which webviews are alive, their order of last access. | `Mutex<HashMap<String, WebviewEntry>>` in Core |
| AppsConfig | Reads/writes `~/.nexus/apps.json`. Owned by Rust, surfaced to frontend via commands. | `Mutex<AppsConfig>` loaded at startup |
| GlobalShortcutPlugin | Registers Cmd+K, Cmd+1..9, Cmd+B, Cmd+R as OS-level shortcuts. | `tauri-plugin-global-shortcut` |
| ConfigWatcher | Watches `~/.nexus/apps.json` for external edits, emits `config-changed` event to shell. | `notify` crate + Tauri event |

## Recommended Project Structure

```
nexus/
├── src/                          # Shell WebView (React)
│   ├── components/
│   │   ├── Sidebar.tsx           # App list, groups, drag-drop
│   │   ├── SidebarItem.tsx       # Single app entry with badge dot
│   │   ├── CommandPalette.tsx    # Cmd+K fuzzy search overlay
│   │   └── WebviewContainer.tsx  # Placeholder/resize logic for app area
│   ├── hooks/
│   │   ├── useApps.ts            # Read apps config from Rust
│   │   ├── useWebviewManager.ts  # create/switch/destroy webviews via IPC
│   │   └── useShortcuts.ts       # In-window shortcut bindings (Cmd+B, Cmd+R)
│   ├── store/
│   │   └── appStore.ts           # Zustand: activeApp, sidebarOpen, appList
│   ├── lib/
│   │   └── tauri.ts              # Typed invoke wrappers (tauri-specta bindings)
│   └── main.tsx
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # App builder, plugin registration
│   │   ├── commands/
│   │   │   ├── config.rs         # load_config, save_config, reorder_apps
│   │   │   └── webview.rs        # create_app_webview, switch_to_app, destroy_webview
│   │   ├── state/
│   │   │   ├── app_config.rs     # AppsConfig struct (serde), apps.json I/O
│   │   │   └── webview_registry.rs # WebviewRegistry, LRU eviction logic
│   │   └── watcher.rs            # File watcher for ~/.nexus/apps.json
│   ├── capabilities/
│   │   └── default.json          # Permissions: webview create, fs access, shortcuts
│   └── tauri.conf.json
│
└── ~/.nexus/
    └── apps.json                 # User config (external to project)
```

### Structure Rationale

- **src/store/:** Zustand for UI state (active app, sidebar open state) — stays in frontend, no Rust round-trip needed for render decisions.
- **src-tauri/state/:** Rust-side state for everything that crosses process boundaries or needs to survive webview destruction.
- **src/lib/tauri.ts:** Single file for all `invoke()` calls. Makes it easy to spot the frontend/backend contract and swap mocks in tests.
- **commands/ split by concern:** `config.rs` and `webview.rs` are separate because they have different state dependencies and test surfaces.

## Architectural Patterns

### Pattern 1: Two-WebView Layout (Shell + App)

**What:** One permanent `WebviewWindow` runs the React shell (sidebar + palette). A second webview (or hidden `WebviewWindow`) renders the active web app. Only one app webview is visible at a time — others are hidden (cached) or destroyed (evicted).

**When to use:** Always. This is the core layout model for Nexus.

**Trade-offs:** Shell WebView is lightweight (no external navigation). App webviews are isolated — a crash in one doesn't affect the shell or other apps.

**Example:**
```rust
// Rust side: create an app webview positioned in the content area
WebviewBuilder::new("app-gmail", WebviewUrl::External("https://mail.google.com".parse().unwrap()))
    .position(SIDEBAR_WIDTH as f64, 0.0)
    .size(content_width, window_height)
    .build(&window)?;
```

> **Stability note:** `Webview` child of a window is behind the `unstable` feature flag in Tauri 2.0. The stable workaround is to create a separate `WebviewWindow` with `visible(false)` and call `show()`/`hide()` to swap. This works cross-platform and avoids positioning bugs reported in the unstable API.

### Pattern 2: LRU Webview Pool

**What:** Maintain a fixed-size pool (e.g., N=5) of alive webviews. When a user switches to an app not in the pool, evict the least-recently-used one (destroying it) and create the new one. On switch to a cached app, call `show()` and `hide()` on the others.

**When to use:** When more than N apps are configured. Prevents unbounded RAM growth.

**Trade-offs:** Evicted apps require a page reload on next visit. Keep N configurable. Show a loading indicator during creation.

**Example:**
```rust
pub struct WebviewRegistry {
    webviews: HashMap<String, WebviewEntry>,
    lru_order: VecDeque<String>,
    max_alive: usize,
}

impl WebviewRegistry {
    pub fn activate(&mut self, label: &str) -> Option<String> {
        // Returns label of evicted webview, if any
        if self.webviews.len() >= self.max_alive && !self.webviews.contains_key(label) {
            let evicted = self.lru_order.pop_front().unwrap();
            self.webviews.remove(&evicted);
            return Some(evicted);
        }
        self.touch(label);
        None
    }
}
```

### Pattern 3: Config-First, Command-Driven

**What:** All reads/writes to `~/.nexus/apps.json` happen in Rust. The frontend never touches the filesystem directly. React calls `invoke("load_config")` at startup and `invoke("save_config", { apps })` on mutation. A file watcher emits `config-changed` events if the file is edited externally.

**When to use:** Always. Centralizing file I/O in Rust enforces a clear boundary and avoids permission issues on hardened platforms (macOS sandbox).

**Trade-offs:** Adds one IPC round-trip per config mutation. Acceptable — mutations are user-initiated and infrequent.

### Pattern 4: Event-Driven Shortcut Routing

**What:** Global shortcuts (Cmd+1..9, Cmd+K, Cmd+B, Cmd+R) are registered in Rust via `tauri-plugin-global-shortcut`. When fired, Rust emits a named event to the shell webview (`app://shortcut/switch-1`, etc.). The shell reacts to events and calls the appropriate action.

**When to use:** For all keyboard shortcuts that must work even when an app webview has focus (i.e., the shell React code does not have keyboard focus).

**Trade-offs:** Requires the shortcut plugin. Centralizes shortcut logic in Rust rather than splitting between React `keydown` handlers (which only fire when shell has focus) and Rust (which works always).

## Data Flow

### App Switch Flow

```
User presses Cmd+3
    ↓
tauri-plugin-global-shortcut (Rust)
    ↓ emit("shortcut-fired", { action: "switch", index: 3 })
Shell WebView (React)
    ↓ appStore.setActiveApp(apps[2])
    ↓ invoke("switch_to_app", { label: "app-linear" })
Rust: webview_registry.activate("app-linear")
    ↓ maybe evict LRU → destroy_webview(evicted_label)
    ↓ create_webview("app-linear", url) OR webview.show()
    ↓ hide all other app webviews
    ↓ return { status: "active" | "created" | "loading" }
Shell React: render loading state if "created", clear it on page-load event
```

### Config Load Flow

```
App startup
    ↓
Rust: read ~/.nexus/apps.json → parse → store in Mutex<AppsConfig>
    ↓ return AppsConfig JSON to shell
Shell React: invoke("load_config") → Zustand appStore.setApps(result)
    ↓ Sidebar renders app list
```

### Config Write Flow (reorder / add / remove)

```
User drags app in sidebar
    ↓
React: local optimistic update in Zustand
    ↓ invoke("save_config", { apps: newOrder })
Rust: validate → write ~/.nexus/apps.json
    ↓ return Ok
React: confirm (already showing optimistic state)
```

### Badge Notification Flow

```
App WebView title changes (page navigation / unread count update)
    ↓
Rust: listen to webview title-changed event
    ↓ compare to last known title for that label
    ↓ emit("app-badge-update", { label, hasUpdate: true })
Shell React: update badge dot in Zustand → Sidebar re-renders
```

### State Management Summary

```
Rust (source of truth)            React (UI state)
──────────────────────            ────────────────
Mutex<AppsConfig>        ──IPC──▶ Zustand: apps[]
Mutex<WebviewRegistry>   ◀──IPC── Zustand: activeAppLabel
                                  Zustand: sidebarOpen
                                  Zustand: commandPaletteOpen
                                  useState: command palette query
```

## Scaling Considerations

This is a single-user desktop app. "Scaling" means: how does it hold up as the user adds more web apps?

| Scale | Architecture Adjustment |
|-------|--------------------------|
| 1-5 apps | All webviews kept alive. No eviction needed. |
| 6-15 apps | LRU pool (N=5 default). Apps outside pool reload on visit. |
| 15+ apps | Same LRU pool, but consider N configurable by user in apps.json. Startup impact is negligible (lazy creation). |

### Scaling Priorities

1. **First bottleneck: RAM per alive webview.** Each WebKit instance holds DOM + JS heap. On macOS, each WKWebView is ~50–150MB depending on the app. At N=5, expect 250–750MB total webview RAM. Keep `max_alive` at 5 as the default. Let users tune it.
2. **Second bottleneck: Startup time.** Config is a JSON file read — negligible. Don't pre-create webviews at startup. Create on first navigation.

## Anti-Patterns

### Anti-Pattern 1: Using Unstable Multiwebview as Primary Strategy

**What people do:** Enable `features = ["unstable"]` in Tauri and use `Window::add_child` to embed multiple webviews in one window, treating it as stable.

**Why it's wrong:** The multiwebview in-window API had multiple open bugs in 2024 (positioning failures, only last child rendered, resize issues). It is explicitly flagged as unstable and API-breaking changes are expected.

**Do this instead:** Use hidden `WebviewWindow` instances as the stable workaround. Create separate `WebviewWindow` with `visible(false)`, then `show()`/`hide()` to swap. Revisit the in-window approach when Tauri stabilizes the feature (track the `unstable` flag removal).

### Anti-Pattern 2: Managing WebView Lifecycle from React

**What people do:** Call `new Webview(...)` or `WebviewWindow.getCurrent().hide()` from React JavaScript to manage which app is displayed.

**Why it's wrong:** Creates split ownership — React and Rust both think they own webview state, leading to race conditions and stale state when events arrive out of order.

**Do this instead:** React invokes Rust commands for all lifecycle changes (`create_app_webview`, `switch_to_app`, `destroy_webview`). Rust owns WebviewRegistry. React reflects state it receives back from Rust.

### Anti-Pattern 3: Storing Session Data in Apps.json

**What people do:** Write login tokens, cookies, or session metadata into `~/.nexus/apps.json` alongside app config.

**Why it's wrong:** The config file is designed to be version-controllable and shareable. Session data is sensitive, per-device, and changes constantly.

**Do this instead:** Let WebKit manage sessions automatically. On macOS, WKWebView persists cookies to `~/Library/WebKit/<bundle-id>/`. On Linux, to `~/.local/share/<bundle-id>/`. Sessions survive restarts without explicit management. For apps that don't persist sessions, this is a per-app WebView isolation issue — do not try to solve it in apps.json.

### Anti-Pattern 4: Binding Keyboard Shortcuts Only in React

**What people do:** Add `document.addEventListener("keydown", ...)` in the shell WebView to catch Cmd+1..9.

**Why it's wrong:** When an app WebView has focus (the user is interacting with Slack or Gmail), the shell WebView's `keydown` listeners do not fire. Shortcuts stop working the moment the user clicks into a web app.

**Do this instead:** Register all global shortcuts via `tauri-plugin-global-shortcut` in Rust. Rust emits events to the shell; the shell handles state changes. This works regardless of which webview has OS focus.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Web apps (Gmail, Slack, etc.) | Native WebView navigation — Tauri loads the URL, the OS WebView renders it | No custom integration. Treat as black-box browser tabs. |
| OS file system (apps.json) | Rust `std::fs` + `notify` watcher | Path: `~/.nexus/apps.json`. Use `dirs` crate for cross-platform home dir. |
| System browser | `tauri-plugin-opener` or `open::that()` | For external link interception from app webviews. |
| OS global shortcuts | `tauri-plugin-global-shortcut` | Platform-specific modifier keys (Cmd on macOS, Ctrl on Windows/Linux). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Shell WebView ↔ Rust Core | `invoke()` commands + `listen()` events | All state mutations go through commands. Events push updates back. |
| Rust Core ↔ App WebViews | WebView lifecycle methods (show/hide/close) + title-changed events | App webviews do not communicate with the shell directly — Rust mediates. |
| App WebViews ↔ each other | None | Webviews are isolated. No cross-webview messaging needed or desired. |
| Config file ↔ Rust Core | `std::fs::read_to_string` / `write_all` + `notify` watcher | Watch for external edits. Debounce watcher events (300ms) to avoid thrash. |

## Build Order Implications

Dependencies flow in this order — phases should follow:

1. **Config layer first** (Rust `AppsConfig` struct, `load_config`/`save_config` commands, JSON schema). Everything else depends on having a list of apps.
2. **Shell WebView + Sidebar** (React, Zustand store, Sidebar component reading config). This is the primary UI surface.
3. **WebView lifecycle** (create, show/hide, destroy in Rust + `switch_to_app` command). Unblocks actual app loading.
4. **LRU eviction** (WebviewRegistry with pool management). Can be deferred — build with "no eviction" first, add LRU in a later pass.
5. **Global shortcuts** (plugin registration, event routing to shell). Depends on Sidebar + webview switching being functional.
6. **Command palette** (overlay component + fuzzy search). Depends on app list (config) and shortcut trigger.
7. **Badge dots** (title-changed event listener in Rust → shell event). Polish layer, no blocking dependencies.
8. **Drag-and-drop reorder** (Sidebar drag + `save_config`). Depends only on config layer and Sidebar.

## Sources

- [Tauri Architecture — v2.tauri.app](https://v2.tauri.app/concept/architecture/)
- [Tauri Process Model — v2.tauri.app](https://v2.tauri.app/concept/process-model/)
- [Webview JS API — v2.tauri.app](https://v2.tauri.app/reference/javascript/api/namespacewebview/)
- [WebviewWindow JS API — v2.tauri.app](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/)
- [Tauri State Management — v2.tauri.app](https://v2.tauri.app/develop/state-management/)
- [Tauri IPC / Calling Rust — v2.tauri.app](https://v2.tauri.app/develop/calling-rust/)
- [Global Shortcut Plugin — v2.tauri.app](https://v2.tauri.app/plugin/global-shortcut/)
- [Multiwebview unstable PR #8280 — github.com/tauri-apps/tauri](https://github.com/tauri-apps/tauri/pull/8280)
- [Multiwebview bug: only last child rendered — Issue #11376](https://github.com/tauri-apps/tauri/issues/11376)
- [Sidebar + embedded webview discussion — Issue #12927](https://github.com/tauri-apps/tauri/discussions/12927)
- [Cookie/session persistence — Issue #6330](https://github.com/tauri-apps/tauri/issues/6330)
- [Memory management: close vs hide — Discussion #6308](https://github.com/tauri-apps/tauri/discussions/6308)
- [dannysmith/tauri-template — production-ready Tauri v2 + React template](https://github.com/dannysmith/tauri-template)
- [Tauri 2.0 Stable Release blog](https://v2.tauri.app/blog/tauri-20/)

---
*Architecture research for: Tauri 2 multi-webview desktop browser (Nexus)*
*Researched: 2026-03-18*

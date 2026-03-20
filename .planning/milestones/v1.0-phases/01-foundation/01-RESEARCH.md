# Phase 1: Foundation - Research

**Researched:** 2026-03-18
**Domain:** Tauri 2 (Rust + React 18 + Vite + Tailwind CSS) — WebviewWindow management, session isolation, file-watching, IPC boundary
**Confidence:** HIGH (core APIs verified against official Tauri docs and source code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Config schema:** `id`, `name`, `url`, `group` fields only per app. Favicon auto-fetched from URL (not a stored field).
- **Groups:** Separate `groups` section with `id` + display name. Apps reference group id. Apps without valid group go to auto "Other" group at the end.
- **Hot reload:** File watcher active on `~/.nexus/apps.json`, updates sidebar immediately on change.
- **External links:** "External" = different domain from app's base domain; subdomains of same domain stay inside webview.
- **OAuth flows:** `accounts.google.com`, `login.microsoftonline.com`, etc. stay inside webview — do not break auth.
- **Popups (window.open):** Same domain stays inside webview; different domain (non-OAuth) goes to system browser.
- **No visual feedback** when opening external link — silent behavior.
- **Phase 1 sidebar:** Flat list with favicon + name, click to switch webview. No groups, no collapse, no dark mode polish, no shortcuts.
- **Fixed sidebar width** (not resizable).
- **Webviews:** Created on first click, kept alive once created. NOT created at startup.
- **First-run:** If `~/.nexus/apps.json` doesn't exist, auto-create it with example apps (Linear, Plane, Gmail, GitHub) in 2 groups ("Mis Productos", "Tools"). `plane.botto.is` goes in "Mis Productos".
- **Tech stack:** Tauri 2 (Rust backend) + React 18 + TypeScript + Vite + Tailwind CSS. No alternatives.
- **Architecture:** Use `WebviewWindow` per app (not `multiwebview` flag). All IPC flows through Rust backend. Global shortcuts in Rust, not React.
- **Session isolation:** Pass unique `data_directory` per app from first webview creation. Retrofitting forces user logout.

### Claude's Discretion
- Favicon fetching strategy (how to fetch/cache favicons)
- Heuristic for detecting OAuth flows vs normal external links
- Internal structure of the IPC boundary (Tauri commands, event system)
- Basic sidebar styling (only functional, doesn't need to look great)
- Error handling for invalid or corrupt config

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONF-01 | User can define apps in `~/.nexus/apps.json` with id, name, url, and group fields | `serde` + `serde_json` for JSON parsing; `dirs` crate for `~` expansion; first-run auto-creation pattern documented |
| CONF-04 | App reads and watches `~/.nexus/apps.json` for external changes and reloads automatically | `tauri-plugin-fs` `watch()` API verified; emits events to React frontend via `app.emit()` |
| WEB-01 | Each app loads its URL in a dedicated webview | `WebviewWindowBuilder::new()` API confirmed; label + URL pattern documented |
| WEB-05 | Sessions (cookies, login state) persist across app restarts | `data_store_identifier([u8; 16])` for macOS 14+ (Phase 1 target); bug fixed in wry PR #1512 |
| WEB-06 | Each app has isolated session storage (separate data directory) | `data_store_identifier` with per-app UUID bytes — the correct macOS isolation mechanism |
| WEB-07 | External links (different domain) open in system default browser | `on_navigation` returning `false` + `opener::open_url()` pattern confirmed |
| PLAT-01 | App builds and runs on macOS arm64 | `create-tauri-app` scaffold targets macOS; `data_store_identifier` requires macOS 14+ (all M1 Macs support Sonoma) |
</phase_requirements>

---

## Summary

Nexus Phase 1 establishes all irreversible architectural decisions: the scaffold, session isolation model, IPC boundary shape, file-watcher integration, and external link routing. The tech stack (Tauri 2 + React 18 + Vite + Tailwind CSS v4) has first-class support in Tauri's `create-tauri-app` scaffolder.

The most critical finding is about session isolation: `data_directory` does NOT work on macOS WKWebView. The correct macOS mechanism is `data_store_identifier([u8; 16])`, which requires macOS 14+ and uses WKWebsiteDataStore's non-ephemeral store API. This was confirmed from the Tauri source and the issue tracker. A bug where `[0; 16]` caused crashes is fixed in wry PR #1512 (merged early March 2025) — the fix is in Tauri 2.x releases post-March 2025. Since Phase 1 targets macOS arm64 only, and all Apple Silicon Macs support macOS 14 Sonoma, this approach is safe.

External link handling uses `on_navigation` (returns `bool`) to intercept navigation: when the destination domain differs from the app's base domain (and is not an OAuth provider), the closure returns `false` to cancel navigation and then calls `opener::open_url()` to launch the system browser. Popup handling (`window.open`) uses `on_new_window` with `NewWindowResponse` to either allow the popup in-webview (same domain / OAuth) or open it in the system browser (different domain).

**Primary recommendation:** Scaffold with `create-tauri-app` (React + TypeScript), configure Tailwind CSS v4 with the Vite plugin, use `data_store_identifier` (not `data_directory`) for session isolation on macOS, and build the IPC boundary as a set of typed Rust commands behind `#[tauri::command]` with a centralized `AppState` managed via `Mutex<T>`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri | 2.x (latest) | Desktop shell, webview management, IPC | The locked stack choice |
| @tauri-apps/api | 2.x | Frontend JS bindings for Tauri IPC | Ships with Tauri 2 |
| react | 18.x | UI framework for sidebar shell | Locked stack |
| typescript | 5.x | Type safety | Locked stack |
| vite | 6.x | Frontend build tool | Ships with create-tauri-app |
| tailwindcss | 4.x | Utility CSS | Locked stack — v4 has dedicated Vite plugin |
| @tailwindcss/vite | 4.x | Tailwind v4 Vite integration | Replaces PostCSS config in v4 |
| serde | 1.x | Rust serialization | Required for all IPC data and JSON |
| serde_json | 1.x | JSON parsing for apps.json | Config file format |
| dirs | 5.x | Home directory resolution (`~`) | Resolves `~/.nexus/apps.json` correctly |

### Supporting — Rust
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-plugin-fs | 2.x | File watching for hot-reload | `watch()` API for apps.json changes |
| tauri-plugin-opener | 2.x | Open URLs in system browser | External link routing (WEB-07) |
| uuid | 1.x | Generate UUID bytes for data_store_identifier | Session isolation per app (WEB-05, WEB-06) |
| tokio | 1.x | Async runtime | Already pulled in by Tauri; use for async commands |

### Supporting — Frontend
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-fs | 2.x | Frontend JS API for file watcher | `watch()` from React for hot-reload |
| @tauri-apps/plugin-opener | 2.x | Frontend JS API for opener | (Needed if opening URLs from shell; mostly Rust-side) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `data_store_identifier` (macOS 14+) | `data_directory` | `data_directory` does NOT work on macOS WKWebView — cannot provide session isolation on Phase 1's target platform |
| `tauri-plugin-fs watch()` | `notify` crate directly in Rust | Tauri plugin is simpler; direct `notify` requires custom Rust→frontend event plumbing |
| Google Favicon API (`s2/favicons`) | Parse HTML `<link rel="icon">` | Google API is instant, no reqwest HTML parsing; fine for MVP — can upgrade later |
| Tailwind CSS v4 | Tailwind CSS v3 | v4 is the current release (Jan 2025); simpler setup with dedicated Vite plugin, no `tailwind.config.js` needed |

**Installation:**
```bash
# Scaffold
npm create tauri-app@latest

# Additional Rust dependencies (Cargo.toml)
# tauri-plugin-fs = "2"
# tauri-plugin-opener = "2"
# dirs = "5"
# uuid = { version = "1", features = ["v4"] }
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"

# Additional JS dependencies
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-opener
```

---

## Architecture Patterns

### Recommended Project Structure
```
nexus/
├── src/                         # React frontend (shell UI only)
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Root component with sidebar
│   ├── components/
│   │   └── Sidebar.tsx          # App list, click to switch
│   ├── hooks/
│   │   └── useAppsConfig.ts     # Watches apps.json, returns apps list
│   ├── types.ts                 # Shared TypeScript types (AppConfig, Group)
│   └── index.css                # @import "tailwindcss"
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Desktop entry (calls lib::run())
│   │   ├── lib.rs               # Tauri builder, plugin registration, setup
│   │   ├── commands/
│   │   │   ├── mod.rs           # Re-exports all commands
│   │   │   ├── config.rs        # load_config, save_config commands
│   │   │   └── webview.rs       # create_app_webview, switch_app commands
│   │   ├── config.rs            # AppConfig/Group structs, JSON read/write, file watcher
│   │   └── state.rs             # AppState struct (app registry, active app)
│   ├── capabilities/
│   │   └── default.json         # Permissions for fs, opener plugins
│   ├── tauri.conf.json
│   └── Cargo.toml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Pattern 1: Session-Isolated WebviewWindow (macOS 14+)

**What:** Each app webview gets a unique `data_store_identifier` derived from the app's `id`. This maps to a distinct WKWebsiteDataStore on macOS, ensuring cookies/localStorage are fully isolated.

**When to use:** Every time a new app webview is created (on first click).

**Critical:** `data_store_identifier` takes `[u8; 16]`. Generate bytes deterministically from the app id (e.g., via MD5 or first 16 bytes of a UUID v5 from the app id) so sessions survive app restarts without storing the UUID. Do NOT use `[0; 16]` — this crashed pre-March-2025 builds and is semantically wrong (all zeros = same store for all apps).

**Example:**
```rust
// Source: tauri source /crates/tauri/src/webview/webview_window.rs + issue #12843 fix
use tauri::webview::WebviewWindowBuilder;

fn make_store_id(app_id: &str) -> [u8; 16] {
    // Stable 16-byte ID derived from app_id using MD5 or blake3 truncated
    // Using md5 for simplicity (add md5 = "0.7" to Cargo.toml)
    let digest = md5::compute(app_id.as_bytes());
    digest.0  // md5::Digest is [u8; 16]
}

pub fn create_app_webview(
    app: &AppHandle,
    app_id: &str,
    url: &str,
) -> tauri::Result<WebviewWindow> {
    let label = format!("app-{}", app_id);
    let store_id = make_store_id(app_id);

    WebviewWindowBuilder::new(app, &label, tauri::WebviewUrl::External(url.parse()?))
        .title("")
        .data_store_identifier(store_id)  // macOS 14+ session isolation
        .on_navigation({
            let base_domain = extract_base_domain(url).to_string();
            move |nav_url| {
                let nav_domain = extract_base_domain(nav_url.as_str());
                let same_domain = nav_domain == base_domain
                    || is_subdomain_of(&nav_domain, &base_domain);
                let is_oauth = is_oauth_provider(nav_url.as_str());
                same_domain || is_oauth
                // returning false cancels navigation; caller opens system browser
            }
        })
        .on_new_window({
            let base_domain = extract_base_domain(url).to_string();
            move |popup_url, _features| {
                let popup_domain = extract_base_domain(popup_url.as_str());
                let allow_in_webview = popup_domain == base_domain
                    || is_subdomain_of(&popup_domain, &base_domain)
                    || is_oauth_provider(popup_url.as_str());
                if allow_in_webview {
                    tauri::webview::NewWindowResponse::Allow
                } else {
                    // open_url in system browser and deny
                    tauri::webview::NewWindowResponse::Deny
                }
            }
        })
        .build()
}
```

### Pattern 2: IPC Command Structure

**What:** All frontend→backend communication uses `#[tauri::command]` functions registered with `generate_handler!`. Typed Rust structs serialized with `serde` flow cleanly to TypeScript.

**When to use:** Every user action that requires Rust (creating webview, reading config, etc.).

**Example:**
```rust
// Source: https://v2.tauri.app/develop/calling-rust/
use tauri::State;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub active_app_id: Option<String>,
    // webview registry: app_id -> bool (created?)
    pub webviews_created: std::collections::HashSet<String>,
}

#[tauri::command]
pub fn switch_app(
    app_id: String,
    state: State<'_, Mutex<AppState>>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    // hide all webviews, show target
    state.active_app_id = Some(app_id);
    Ok(())
}
```

```typescript
// Source: https://v2.tauri.app/develop/calling-rust/
import { invoke } from '@tauri-apps/api/core';

await invoke('switch_app', { appId: 'linear' });
```

### Pattern 3: File Watcher → React Hot Reload

**What:** `tauri-plugin-fs` `watch()` monitors `~/.nexus/apps.json`. On change, Rust reads the file and emits a `config-updated` event to the frontend with the new config.

**Two approaches for sending data to frontend:**
- Option A: Frontend calls `watch()` from JS, gets callbacks with file event; then calls `load_config` IPC to get fresh data.
- Option B: Rust backend watches file and uses `app.emit("config-updated", &new_config)` to push new config.

**Recommendation:** Option A (frontend-owned watch) is simpler for Phase 1 — the `watch()` JS API triggers a re-invoke of `load_config`.

**Example:**
```typescript
// Source: https://v2.tauri.app/plugin/file-system/
import { watch, BaseDirectory } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';

async function setupConfigWatcher(onConfigChange: () => void) {
    const home = await homeDir();
    await watch(
        `${home}/.nexus/apps.json`,
        (_event) => {
            onConfigChange(); // triggers re-invoke of load_config
        },
        { delayMs: 300 }
    );
}
```

### Pattern 4: External Link Routing

**What:** `on_navigation` intercepts all URL navigations in an app webview. If the destination is external (different domain, non-OAuth), cancel and open in system browser.

**When:** Set on every `WebviewWindowBuilder` at creation time (can't be changed after build).

**Example:**
```rust
// Source: https://v2.tauri.app/plugin/opener/
use tauri_plugin_opener::OpenerExt;

// Called from the on_navigation closure when navigation should go to browser
fn open_external(app: &AppHandle, url: &str) {
    let _ = app.opener().open_url(url, None::<&str>);
}

// OAuth provider heuristic
fn is_oauth_provider(url: &str) -> bool {
    const OAUTH_DOMAINS: &[&str] = &[
        "accounts.google.com",
        "login.microsoftonline.com",
        "github.com/login",
        "auth0.com",
        "okta.com",
    ];
    OAUTH_DOMAINS.iter().any(|d| url.contains(d))
}
```

### Pattern 5: Config File Loading with First-Run

**What:** On startup, load `~/.nexus/apps.json`. If not found, create it with default apps.

**Example:**
```rust
// Source: dirs crate docs + serde_json
use dirs::home_dir;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub group: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GroupConfig {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NexusConfig {
    pub groups: Vec<GroupConfig>,
    pub apps: Vec<AppConfig>,
}

pub fn config_path() -> std::path::PathBuf {
    let mut path = home_dir().expect("cannot resolve home dir");
    path.push(".nexus");
    path.push("apps.json");
    path
}

pub fn load_or_create_config() -> NexusConfig {
    let path = config_path();
    if !path.exists() {
        let default = default_config();
        let _ = std::fs::create_dir_all(path.parent().unwrap());
        let _ = std::fs::write(&path, serde_json::to_string_pretty(&default).unwrap());
        return default;
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_else(|_| default_config())
}
```

### Anti-Patterns to Avoid

- **Using `data_directory` for macOS session isolation:** It does NOT work with WKWebView on macOS. Only `data_store_identifier` creates true per-app isolation on macOS.
- **Creating all webviews at startup:** Violates WEB-02 (lazy loading) and hurts startup time. Create on first click only.
- **Passing `[0; 16]` to `data_store_identifier`:** All-zeros is invalid (was a crash before the fix) and conceptually wrong — all apps would share the same store.
- **Mutating state from both Rust and React:** All config/state mutations go through Rust commands. React is read-only display.
- **Registering global keyboard shortcuts in React:** App webviews steal keyboard focus. All shortcuts must be registered in Rust via `app.global_shortcut()`.
- **Using `target="_blank"` links and trusting the shell to open them:** By default Tauri opens new windows inside the app. Intercept with `on_navigation` + `on_new_window` explicitly.
- **Storing `uuid::Uuid` values for `data_store_identifier`:** Derive them deterministically from `app_id` so sessions survive restart without a UUID database.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session isolation | Custom cookie jar or manual profile directory logic | `data_store_identifier` | macOS WKWebsiteDataStore API handles all the hard parts |
| External URL opening | Shell exec, AppleScript, `open` CLI | `tauri-plugin-opener` | Cross-platform, handles permissions, correct API |
| File watching | `inotify`/`kqueue` bindings directly | `tauri-plugin-fs watch()` | Built on `notify` crate, cross-platform, debounced |
| Favicon fetching | HTML parsing + `<link>` tag extraction | Google Favicon API `https://www.google.com/s2/favicons?domain=X&sz=32` | CDN-backed, instant, no reqwest HTML parsing needed for Phase 1 |
| UUID generation for store IDs | Custom hash-to-bytes | `md5` crate digest | MD5 output is `[u8; 16]` — exactly what `data_store_identifier` needs |
| Frontend→Rust communication | Custom WebSocket, filesystem polling | `invoke()` from `@tauri-apps/api/core` | First-class Tauri IPC, type-safe, secure |

**Key insight:** Tauri's plugin ecosystem solves the hardest cross-platform problems. Custom implementations will miss platform-specific edge cases (e.g., macOS data store handling is fundamentally different from Windows WebView2 profiles).

---

## Common Pitfalls

### Pitfall 1: `data_directory` vs `data_store_identifier` on macOS

**What goes wrong:** Developer calls `.data_directory(path)` on `WebviewWindowBuilder`, the directory is created but empty, sessions are not isolated, and all apps share the same cookie jar.

**Why it happens:** On macOS, WKWebView does not support custom `data_directory` paths. The Tauri docs and source code confirm this: `data_store_identifier` is documented as "Can be used as a replacement for data_directory not being available in WKWebView."

**How to avoid:** Always use `data_store_identifier([u8; 16])` for macOS. Since Phase 1 only targets macOS arm64 (PLAT-01), this is the only needed approach. macOS 14+ requirement: all Apple Silicon Macs support Sonoma.

**Warning signs:** Sessions bleed between apps (e.g., logging into Gmail shows you as the same user in Linear).

### Pitfall 2: `[0; 16]` all-zeros UUID crash

**What goes wrong:** Passing `[0; 16]` to `data_store_identifier` causes a panic on macOS: "invalid message send to -[__NSConcreteUUID initWithUUIDBytes:]".

**Why it happens:** The objc2 Objective-C bindings require a valid UUID format. The bug was in wry and was fixed in wry PR #1512 (Tauri ≥ 2.x post-March 2025).

**How to avoid:** Derive the 16 bytes deterministically from the app id using a hash (e.g., `md5::compute(app_id.as_bytes()).0`). This also ensures session persistence across restarts.

**Warning signs:** Crash on webview creation, not on navigation.

### Pitfall 3: `on_navigation` Not Firing for `window.open` Popups

**What goes wrong:** External-domain popup windows (from OAuth or other sources) appear in a new Tauri-managed window instead of the system browser because `on_navigation` only fires for navigations within the same webview.

**Why it happens:** `window.open()` triggers a new window request, not a navigation event. These are two separate callbacks.

**How to avoid:** Set BOTH `on_navigation` AND `on_new_window` on every app webview. `on_navigation` handles in-page navigations; `on_new_window` handles `window.open()` calls.

**Warning signs:** Popup OAuth dialogs (e.g., Google account picker) open in a blank Tauri window instead of the system browser.

### Pitfall 4: App Webviews Stealing Keyboard Focus

**What goes wrong:** Keyboard shortcut handlers in React (`useEffect` + `keydown` listener) stop working when an app webview has focus. Since the webview is a separate OS window, it captures all keyboard input.

**Why it happens:** App WebviewWindows are independent OS-level windows. Keyboard events don't bubble through the webview into the shell.

**How to avoid:** Register all global shortcuts in Rust using Tauri's `app.global_shortcut()` API (Phase 2 work, but architecture must account for it now — don't build any shortcut handling in React).

**Warning signs:** `Cmd+1`, `Cmd+B` only work when the sidebar/shell window has focus.

### Pitfall 5: File Watcher Triggers on Temp Files During Save

**What goes wrong:** Editors like VSCode perform atomic saves (write to `.apps.json.tmp`, rename to `apps.json`). The rename triggers the watcher multiple times or fires before the file is completely written.

**Why it happens:** File system events are low-level — a rename and a modify can both fire. `watch()` fires on any change event.

**How to avoid:** Use `watch()` with `delayMs: 300` (debounce) rather than `watchImmediate()`. After receiving an event, read the file and validate JSON before emitting to the frontend — if JSON is invalid, discard the event.

**Warning signs:** Sidebar briefly shows invalid/empty state when saving apps.json.

### Pitfall 6: WebviewWindow Label Collisions

**What goes wrong:** Creating a `WebviewWindow` with a label that's already in use throws an error and crashes.

**Why it happens:** Tauri requires unique labels per window. If the app tries to create a webview for an app that already has one (e.g., rapid double-click), Tauri panics.

**How to avoid:** Track which webviews have been created in `AppState.webviews_created`. In the `switch_app` command, check before creating. Use `app_handle.get_webview_window(&label)` to check existence at the Tauri API level.

---

## Code Examples

### Capabilities File

```json
// Source: https://v2.tauri.app/security/capabilities/
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for Nexus shell window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:path:default",
    "core:window:default",
    "core:webview:default",
    "fs:default",
    "fs:allow-watch",
    "opener:default",
    "opener:allow-open-url"
  ]
}
```

### Tailwind CSS v4 + Vite Setup

```typescript
// Source: https://tailwindcss.com/blog/tailwindcss-v4
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
```

```css
/* src/index.css */
@import "tailwindcss";
```

### Rust `lib.rs` Setup Skeleton

```rust
// src-tauri/src/lib.rs
use tauri::Manager;
use std::sync::Mutex;

mod commands;
mod config;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = config::load_or_create_config();
            app.manage(Mutex::new(AppState::new(config)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::load_config,
            commands::config::reload_config,
            commands::webview::create_app_webview,
            commands::webview::switch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Default apps.json First-Run

```json
{
  "groups": [
    { "id": "mis-productos", "name": "Mis Productos" },
    { "id": "tools", "name": "Tools" }
  ],
  "apps": [
    { "id": "plane", "name": "Plane", "url": "https://plane.botto.is", "group": "mis-productos" },
    { "id": "linear", "name": "Linear", "url": "https://linear.app", "group": "tools" },
    { "id": "gmail", "name": "Gmail", "url": "https://mail.google.com", "group": "tools" },
    { "id": "github", "name": "GitHub", "url": "https://github.com", "group": "tools" }
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 + `tailwind.config.js` + PostCSS | Tailwind v4 + `@tailwindcss/vite` plugin, `@import "tailwindcss"` | Jan 2025 (v4.0) | No `tailwind.config.js` needed; faster build |
| `tauri::Window` + separate WebviewBuilder | `WebviewWindow` (combined) | Tauri 2.0 stable (Oct 2024) | Single builder for window + webview |
| `data_directory` for all platforms | `data_store_identifier` on macOS, `data_directory` on Windows/Linux | Tauri 2.x (macOS WKWebView limitation) | Different code paths per platform required in Phase 5 |
| `wry [0; 16]` bug (crash) | Fixed in wry PR #1512 | March 2025 | Must use Tauri post-March-2025 to avoid crash |
| Plugin permissions in `tauri.conf.json` inline | Separate `capabilities/*.json` files | Tauri 2.0 | Cleaner separation; auto-detected from `capabilities/` dir |

**Deprecated/outdated:**
- `tauri::WindowBuilder` (v1): Replaced by `WebviewWindowBuilder` in Tauri 2
- `@tailwind base/components/utilities` directives: Replaced by `@import "tailwindcss"` in v4
- `tauri::generate_handler!` with commands in `main.rs`: Now put commands in `lib.rs` (mobile compatibility)

---

## Open Questions

1. **`data_store_identifier` behavior on macOS 13 (Ventura)**
   - What we know: Docs say macOS 14+. Phase 1 only targets arm64.
   - What's unclear: Do all current arm64 Macs run macOS 14+? (Yes — all M1/M2/M3 Macs support Sonoma. macOS 13 Ventura was released Sept 2022 but Sonoma is the current default.)
   - Recommendation: Add a minimum macOS version guard in `tauri.conf.json` (`"minimumSystemVersion": "14.0"` for macOS target in Phase 1). Document that Phase 5 (cross-platform) will need a fallback for macOS 13 users.

2. **`on_new_window` return type for opening in system browser**
   - What we know: `NewWindowResponse::Deny` denies the popup; `NewWindowResponse::Allow` allows it. But `Deny` alone doesn't open the URL in the system browser.
   - What's unclear: Does `Deny` fire a secondary event that the caller can hook to open the URL? Or must the `on_new_window` closure manually call `opener::open_url()` before returning `Deny`?
   - Recommendation: In the `on_new_window` closure, explicitly call `app_handle.opener().open_url(url, None)` for external-domain popups, then return `Deny`. This is the safe pattern even if Deny auto-routes.

3. **OAuth domain heuristic completeness**
   - What we know: `accounts.google.com`, `login.microsoftonline.com` are the big ones. Linear uses `auth0.com`.
   - What's unclear: Full exhaustive list for all apps in the default config.
   - Recommendation: Start with a small hardcoded list + "same base domain" rule. This can be extended in Phase 2 without breaking existing sessions.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) — no existing config detected; greenfield project |
| Config file | `vite.config.ts` (inline `test: {}` block, or separate `vitest.config.ts`) — Wave 0 gap |
| Quick run command | `pnpm vitest run --reporter=dot` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-01 | `load_or_create_config()` returns valid `NexusConfig` from file | unit (Rust) | `cargo test -p nexus -- config` | ❌ Wave 0 |
| CONF-01 | `load_or_create_config()` creates default file when missing | unit (Rust) | `cargo test -p nexus -- config::first_run` | ❌ Wave 0 |
| CONF-01 | `NexusConfig` JSON round-trip (serde serialize/deserialize) | unit (Rust) | `cargo test -p nexus -- config::serde` | ❌ Wave 0 |
| CONF-04 | `watch()` callback fires after file modification (integration) | manual-only | — | N/A (requires live FS) |
| WEB-01 | `create_app_webview` creates window with correct URL | manual-only | — | N/A (requires Tauri runtime) |
| WEB-05 | Session persists across webview close/reopen | manual-only | — | N/A (requires browser session) |
| WEB-06 | App A cookies not visible in App B | manual-only | — | N/A (requires two webviews) |
| WEB-07 | `is_oauth_provider()` returns true for known OAuth domains | unit (Rust) | `cargo test -p nexus -- routing::oauth` | ❌ Wave 0 |
| WEB-07 | `extract_base_domain()` handles subdomains correctly | unit (Rust) | `cargo test -p nexus -- routing::domain` | ❌ Wave 0 |
| PLAT-01 | App builds on macOS arm64 without errors | smoke | `cargo build --target aarch64-apple-darwin` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test -p nexus && pnpm vitest run --reporter=dot`
- **Per wave merge:** `cargo test -p nexus && pnpm vitest run`
- **Phase gate:** Full suite green + manual smoke test of all 5 success criteria before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/config.rs` with `#[cfg(test)]` module — covers CONF-01 serde + first-run
- [ ] `src-tauri/src/routing.rs` with `#[cfg(test)]` module — covers WEB-07 domain/OAuth heuristics
- [ ] `vitest.config.ts` or `vite.config.ts` test block — frontend test infrastructure
- [ ] `src/__tests__/` directory — colocated test files per global CLAUDE.md convention

---

## Sources

### Primary (HIGH confidence)
- Tauri source `crates/tauri/src/webview/webview_window.rs` — `on_navigation`, `on_new_window`, `data_store_identifier`, `data_directory` method signatures
- [Tauri Opener Plugin docs](https://v2.tauri.app/plugin/opener/) — `open_url()` API
- [Tauri Calling Rust docs](https://v2.tauri.app/develop/calling-rust/) — IPC command pattern
- [Tauri Calling Frontend docs](https://v2.tauri.app/develop/calling-frontend/) — `app.emit()` API
- [Tauri File System plugin](https://v2.tauri.app/plugin/file-system/) — `watch()` / `watchImmediate()` API
- [Tauri State Management](https://v2.tauri.app/develop/state-management/) — `Mutex<AppState>` pattern
- [Tauri Capabilities](https://v2.tauri.app/security/capabilities/) — permissions JSON structure
- [Tailwind CSS v4 release](https://tailwindcss.com/blog/tailwindcss-v4) — `@tailwindcss/vite` plugin setup

### Secondary (MEDIUM confidence)
- [Tauri Issue #12843](https://github.com/tauri-apps/tauri/issues/12843) — `data_store_identifier` crash, confirmed fixed in wry PR #1512
- [Tauri Issue #9285](https://github.com/tauri-apps/tauri/issues/9285) — browser profiles proposal; confirmed `data_directory` unsupported on macOS
- [Tauri Issue #14263](https://github.com/tauri-apps/tauri/issues/14263) — popup window creation, confirmed `on_new_window` pattern
- [Tauri Project Structure](https://v2.tauri.app/start/project-structure/) — canonical dir layout
- [create-tauri-app](https://v2.tauri.app/start/create-project/) — React + TypeScript scaffold command

### Tertiary (LOW confidence)
- OAuth provider domain list — synthesized from known services, not from an authoritative source. Validate against actual login flows for Gmail, Linear, Plane, GitHub.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official Tauri 2 docs and source
- Architecture: HIGH — patterns derived from official APIs and confirmed source code
- Session isolation (macOS): HIGH — confirmed from Tauri source + issue tracker, bug fix merged
- Pitfalls: HIGH — all verified against specific GitHub issues or official docs
- OAuth heuristic: LOW — domain list is a reasonable starting point but not exhaustive

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (Tauri moves fast; check for new releases before planning sessions beyond 30 days)

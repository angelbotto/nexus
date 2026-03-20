# Architecture Research

**Domain:** Tauri 2 multi-webview desktop browser app — v2.0 Integration Architecture
**Researched:** 2026-03-20
**Confidence:** HIGH (based on direct codebase inspection + official Tauri 2 docs)

> This document extends the v1.0 architecture research. It focuses on integration points for
> the seven v2.0 features: Spaces, Multi-Account, Split View, Notifications, Polish,
> Preferences, and Code Signing. Each section identifies what changes in Rust vs React,
> what new components are needed, and what data flows change.

---

## Existing Architecture (v1.0 baseline)

```
┌────────────────────────────────────────────────────────────────────┐
│                     OS Window (TAO / main)                         │
│                                                                    │
│  ┌────────────────┐  ┌──────────────────────────────────────────┐  │
│  │  Shell WebView │  │         App WebViews (WRY)               │  │
│  │  label: "main" │  │                                          │  │
│  │                │  │  label: "app-{id}"  (active = visible)  │  │
│  │  Sidebar       │  │  label: "app-{id}"  (cached = hidden)   │  │
│  │  CmdPalette    │  │  ... up to 8 in LRU pool                │  │
│  │  useAppsConfig │  │                                          │  │
│  └───────┬────────┘  └──────────────────────────────────────────┘  │
│          │ invoke() / main_wv.eval(CustomEvent)                     │
├──────────┼─────────────────────────────────────────────────────────┤
│  Rust Core (Mutex<AppState>)                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ config: NexusConfig  active_app_id  webviews_created        │    │
│  │ sidebar_visible      lru_order: VecDeque<String>            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ~/.nexus/apps.json  (groups[], apps[], sidebarCollapsed)           │
└─────────────────────────────────────────────────────────────────────┘
```

**Key v1.0 contracts:**
- Webview labels follow `app-{id}` scheme. `default.json` capability covers `["main", "app-*"]`.
- IPC: React → Rust via `invoke()`. Rust → React via `main_wv.eval(CustomEvent)`.
- `AppState` is a single `Mutex<AppState>` covering all runtime state.
- `NexusConfig` owns app list, groups, and sidebar state. Persisted to `apps.json`.
- Webview session isolation: macOS uses `data_store_identifier` (MD5 of app id); Linux/Windows use `data_directory(platform_data_dir(app_id))`.

---

## Feature Integration Map

### 1. Spaces

**What it is:** Multiple named workspace contexts (Work, Personal, etc.) each with its own independent list of apps.

**Config changes (Rust):**

`NexusConfig` gains a `spaces` array and `active_space_id`. Each `AppConfig` gains an optional `space_id` field (defaults to `"default"` for backward compat).

```rust
// config.rs additions
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SpaceConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
}

// NexusConfig — new fields (all #[serde(default)] for backward compat)
pub spaces: Vec<SpaceConfig>,        // default: []
pub active_space_id: Option<String>, // default: None (= "default" space)
```

`AppConfig` does NOT need a `space_id` field. Spaces own app lists by reference: each `SpaceConfig` carries `app_ids: Vec<String>`. This is cleaner than embedding `space_id` in `AppConfig` and avoids duplicating apps across spaces.

**State changes (Rust):**

`AppState` gains `active_space_id: Option<String>`. When the user switches spaces, `switch_space_impl` must: hide the current space's active webview, update `active_space_id`, restore the previously active app in the new space (stored per-space), and update the shell.

The LRU pool must become space-aware. Simplest approach: keep a single global LRU pool but key the webview label by `{space_id}-app-{app_id}` so webviews from different spaces never collide. The LRU still caps at 8 total alive webviews regardless of space — this keeps RAM bounded.

**Webview label scheme change:**

```
v1: "app-{app_id}"
v2: "s-{space_id}-app-{app_id}"  // or keep "app-{app_id}" for default space
```

The simplest non-breaking approach: keep `app-{app_id}` for the default space and use `{space_id}-app-{app_id}` for named spaces. The `default.json` capability pattern `"app-*"` still matches; add `"{space_id}-app-*"` patterns dynamically or use the broader glob `"*-app-*"`.

**New IPC commands:**

```rust
switch_space(space_id: String) -> Result<(), String>
add_space(name: String) -> Result<SpaceConfig, String>
remove_space(space_id: String) -> Result<(), String>
rename_space(space_id: String, name: String) -> Result<(), String>
```

**React changes:**

`useAppsConfig` hook splits into `useSpaces` + `useAppsConfig`. The `Sidebar` renders a space switcher (above the app list or as tabs). `CommandPalette` adds space-switch actions.

**Data flow — space switch:**

```
User clicks Space tab in Sidebar
    ↓
React: invoke("switch_space", { spaceId })
Rust: hide current active webview
      update AppState.active_space_id
      show last-active webview for new space (or nothing)
      eval CustomEvent("space-switched", { spaceId, activeAppId })
React: update local state, sidebar re-renders app list for new space
```

**Build order dependency:** Spaces depend on config layer stability. Build after config commands are solid but before split view (split view needs space context).

---

### 2. Multi-Account

**What it is:** Same app URL loaded with different isolated sessions — e.g., Gmail Personal + Gmail Work.

**Config changes (Rust):**

Multi-account is modeled as distinct `AppConfig` entries with the same `url` but different `id` values. No structural change to `AppConfig` needed. The session isolation already keys on `app_id` (via `data_store_identifier` or `data_directory`), so two entries with different ids automatically get separate sessions.

The only addition: an optional `account_label` field for display (shown in sidebar under the app name).

```rust
// AppConfig addition
#[serde(default)]
pub account_label: Option<String>,  // e.g., "Work", "Personal"
```

**Webview label:** No change. Each account entry already has a unique `id`, so its label is unique (`app-{id}`).

**React changes:**

The `AddApp` form in `CommandPalette` gains an "Account label" field. `Sidebar` renders the `account_label` as a sub-label under the app name when set. App icon deduplication logic (which uses the URL hostname for the favicon) still works because favicons are fetched per `app.url` regardless of account.

**Session isolation per-platform:**

- macOS: `data_store_identifier` is `MD5(app_id)`. Two entries with ids `gmail-personal` and `gmail-work` get distinct 16-byte store ids — guaranteed isolation.
- Linux/Windows: `data_directory` is `platform_data_dir(app_id)` which includes `app_id` in the path. Same guarantee.

No Rust changes needed for isolation — it already works. The feature is mostly a UX layer.

**Build order:** Multi-account has no new dependencies. Can be built immediately as a config + UI change.

---

### 3. Split View

**What it is:** Two apps visible side by side in the same window.

**This is the highest-complexity feature in v2.0.**

**Current layout model:** One active webview occupies the full content area. `calc_webview_rect` returns a single rect keyed on `sidebar_visible`. Each webview is absolutely positioned via `set_position` + `set_size`.

**Split view requires:** Two webviews simultaneously visible, each occupying half the content area.

**Rust changes — layout:**

`AppState` gains:

```rust
pub split_app_id: Option<String>,   // None = single view, Some = split right pane
pub split_ratio: f64,               // 0.5 = equal halves; default 0.5
```

`calc_webview_rect` becomes `calc_webview_rects(split_app_id: Option<&str>, split_ratio: f64)` returning `(Option<Rect>, Option<Rect>)` — primary and secondary rects.

When `split_app_id` is Some:
- Primary webview gets the left half: `x = sidebar + GAP, w = (content_w - GAP) * ratio - GAP/2`
- Secondary webview gets the right half: `x = sidebar + GAP + primary_w + GAP, w = content_w * (1 - ratio) - GAP/2`

The resize event handler in `lib.rs` must now resize both webviews.

**New IPC commands:**

```rust
enter_split(secondary_app_id: String) -> Result<(), String>
exit_split() -> Result<(), String>
resize_split(ratio: f64) -> Result<(), String>   // for drag-to-resize divider
```

**React changes:**

`App.tsx` needs a divider element between the two app areas (for the floating gap between them — the gap is structural since webviews are native, not DOM). The divider is a thin React DOM element that the user can drag. On drag, React calls `invoke("resize_split", { ratio })`.

`useAppsConfig` hook exposes `splitAppId` and `enterSplit(appId)` / `exitSplit()` actions. The `Sidebar` shows a split-view icon/indicator next to the secondary app.

**Critical constraint:** Native child webviews always render above React DOM (z-order). A resize divider rendered in React DOM will be obscured by the webviews. The solution: position the divider in the gap between the two webviews (there is a `GAP` of 12px on macOS). The divider is a narrow hit target that sits between the two webview rects — it is visible because the native webviews don't overlap it.

On macOS with GAP=12, the divider is: `x = sidebar + GAP + primary_w - 6, width = 12` (centered in the gap). On Linux/Windows with GAP=0, add a forced `GAP_SPLIT = 8` for the split divider.

**LRU pool interaction:** Both the primary and secondary app must be exempt from LRU eviction while split view is active. `switch_app_impl` must check `st.split_app_id` and not evict it.

**Build order:** Split view depends on: the basic webview lifecycle (stable), the resize logic (must be refactored from the single-webview `calc_webview_rect`). Build this after Spaces (because split view shows two apps and the space context matters) and after Polish (because split view introduces a new visual element — the divider).

---

### 4. Notifications

**What it is:** Native OS notifications triggered when a web app (in a background webview) sends a notification (e.g., new Gmail message).

**The core problem:** App webviews load external URLs. The `window.Notification` Web API is blocked in WKWebView by default (macOS) and in WebView2 (Windows) unless explicitly bridged. The MutationObserver title-change trick (already implemented) is a workaround for badges — notifications need a different approach.

**Approach: Rust-side notification via tauri-plugin-notification + JS bridge**

The app webview's `initialization_script` can inject code that intercepts `Notification` constructor calls and forwards them to Rust via `__TAURI_INTERNALS__.invoke`. Rust then fires the OS notification via `tauri-plugin-notification`.

```javascript
// Injected into each app webview via initialization_script
(function() {
  const OriginalNotification = window.Notification;
  window.Notification = function(title, options) {
    try {
      window.__TAURI_INTERNALS__.invoke('send_notification', {
        appId: '__APP_ID__',  // injected at webview creation time
        title: title,
        body: options?.body || ''
      });
    } catch(e) {}
    // Also call original if available (some platforms support it)
    try { return new OriginalNotification(title, options); } catch(e) {}
  };
  window.Notification.permission = 'granted';
  window.Notification.requestPermission = () => Promise.resolve('granted');
})();
```

This pattern is viable because: (1) the init script runs before page JS, (2) `__TAURI_INTERNALS__` is available in child webviews (covered by `default.json` capability with `app-*`), (3) the Rust command handler dispatches via `tauri-plugin-notification`.

**New Rust command:**

```rust
// commands/notifications.rs
#[tauri::command]
pub fn send_notification(
    app_id: String,
    title: String,
    body: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();
    let is_active = {
        let st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id.as_deref() == Some(app_id.as_str())
    };
    if !is_active {
        // Only notify for background apps
        app_handle
            .notification()
            .builder()
            .title(&title)
            .body(&body)
            .show()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

**Cargo.toml addition:**

```toml
tauri-plugin-notification = "2"
```

**capabilities/default.json addition:**

```json
"notification:default"
```

**Permission flow (macOS):** The notification plugin calls `requestPermission()` internally on first use. macOS will prompt the user once. Subsequent calls succeed silently.

**Windows limitation:** Per official docs, the notification plugin shows the PowerShell icon and name in development builds. In production (installed app), it shows the app name and icon. This is acceptable for shipping; code signing (which gives the app a proper identity) will fix the icon.

**Capability concern:** `send_notification` must be invocable from `app-*` webviews. The existing `default.json` already covers `["main", "app-*"]`. Adding `notification:default` to that capability file is sufficient.

**Build order:** Notifications depend only on the existing webview creation machinery. Independent of Spaces, Multi-Account, and Split View. Can be built as a standalone phase.

---

### 5. Polish

**What it is:** Smooth animations, unread count badge (number, not just dot), settings panel, sidebar toggle button.

**Animations:**

Tauri does not constrain CSS animations in the shell WebView — standard CSS transitions and `framer-motion` (if already in the project) work normally. The sidebar slide and app switch transitions are pure CSS/React concerns.

One constraint: the native app webviews do not animate. When switching apps, the webview appears/disappears instantly. To create a perceived transition: hide the webview before switch, briefly show a skeleton/splash in the React DOM, then show the new webview. The `set_active_webview_dimmed` command (already exists) can be adapted for this.

**Unread count badge:**

The existing badge system adds a dot when `app-title-changed` fires. For counts: parse the `(N)` prefix from page titles. Most web apps encode unread count as `(3) Gmail - Inbox` or `(12) Slack | general`. The existing `notify_title_changed` command already passes the full `title` string. The React handler (`handleTitleChanged` in `useAppsConfig.ts`) just needs to extract the count.

```typescript
function extractUnreadCount(title: string): number | null {
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}
```

`badgeAppIds: Set<string>` in `useAppsConfig` becomes `badgeMap: Map<string, number | null>` where `null` means "has update" (dot) and a number means unread count.

No Rust changes needed for unread count.

**Sidebar toggle button:**

Currently sidebar toggle is Cmd+B only. Adding a visible toggle button is pure React (a chevron/arrow icon in the shell). Clicking it dispatches the existing `sidebar-toggle` CustomEvent. No new IPC.

**Settings panel:**

A new React component `SettingsPanel.tsx` rendered as an overlay (like CommandPalette). Accessible via Cmd+, or a gear icon. Since Preferences (the next feature) owns the appearance settings, the Settings panel is the container component that Preferences fills.

**Build order:** Polish is parallel-safe. Unread count and toggle button can be built independently. Settings panel is a prerequisite for Preferences.

---

### 6. Preferences

**What it is:** Customizable appearance — border-radius, colors, gap, themes.

**Config changes:**

Preferences are stored in `NexusConfig` as a `preferences` sub-object (not in `apps.json` main keys to keep it clean):

```rust
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    #[serde(default = "default_theme")]
    pub theme: String,          // "dark" | "light" | "system"
    #[serde(default = "default_accent")]
    pub accent_color: String,   // hex string
    #[serde(default = "default_radius")]
    pub border_radius: f64,     // 0.0–20.0, default 12.0
    #[serde(default = "default_gap")]
    pub gap: f64,               // 0.0–20.0, default 12.0 (macOS) or 0.0
    #[serde(default = "default_font_size")]
    pub sidebar_font_size: u8,  // 12–16, default 13
}

// NexusConfig gains:
#[serde(default)]
pub preferences: Preferences,
```

**The gap and border-radius are currently hardcoded in Rust** (`webview.rs`: `const GAP: f64 = 12.0`, `const GAP_TOP: f64 = 40.0`, corner radius `12.0` in macOS code). For these to be user-configurable, the Rust constants must become values read from `AppState.config.preferences`. This requires threading `preferences.gap` and `preferences.border_radius` through `calc_webview_rect` and the `with_webview` corner radius call.

This is the most invasive part of Preferences — it touches `webview.rs` layout math and requires a new command `apply_preferences` that re-positions the active webview after a preference change.

**React changes:**

`SettingsPanel.tsx` renders sliders and color pickers. Preference changes call `invoke("save_config", { config: updatedConfig })` — the existing save mechanism handles it. Then call `invoke("apply_preferences")` to reposition webviews.

CSS custom properties (Tailwind v4 or CSS vars) drive the theme. When `preferences.theme` changes, React updates `document.documentElement.classList` or a CSS variable — no Rust involvement for theme changes.

**Build order:** Preferences depend on the Settings panel (from Polish) and on refactoring the hardcoded constants in `webview.rs`. Build after Polish.

---

### 7. Code Signing

**What it is:** macOS Developer ID + notarization, Windows certificate via Azure Key Vault. Not a runtime feature — CI/CD and distribution concern.

**macOS requirements:**

- Apple Developer Program account ($99/year) — required for notarization.
- Certificate type: `Developer ID Application` (for outside-App-Store distribution).
- Required GitHub Actions secrets (set once):
  - `APPLE_CERTIFICATE` — base64-encoded `.p12`
  - `APPLE_CERTIFICATE_PASSWORD` — p12 export password
  - `APPLE_ID` — Apple account email (or use API key method)
  - `APPLE_PASSWORD` — App-specific password from appleid.apple.com
  - `APPLE_TEAM_ID` — From developer.apple.com membership
  - `KEYCHAIN_PASSWORD` — Arbitrary password for the build keychain

Tauri's build action reads these via `TAURI_SIGNING_*` env vars and passes them to `xcrun notarytool`. The existing `tauri.conf.json` already sets `macOS.minimumSystemVersion: "14.0"` — no change needed there.

**Windows requirements:**

Since June 2023, OV certificates must be on HSMs. The accessible option for indie developers: Azure Key Vault (free tier is sufficient for low-volume signing). The `relic` tool signs binaries against Azure Key Vault without needing a physical HSM.

Required secrets:
- `AZURE_KEY_VAULT_URI`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_CERT_NAME`

**GitHub Actions integration:**

The existing CI workflow (`tauri-action`) adds `tauriScript` and signing env vars. No Rust code changes. No `tauri.conf.json` changes beyond optionally setting `bundle.macOS.signingIdentity`.

**Build order:** Code signing is entirely independent of all other features. It is a CI/CD task. Build last — requires obtaining certificates which have lead time.

---

## Component Map: New vs Modified

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src-tauri/src/commands/notifications.rs` | Rust | `send_notification` command |
| `src-tauri/src/commands/spaces.rs` | Rust | `switch_space`, `add_space`, `remove_space` |
| `src/components/SettingsPanel.tsx` | React | Preferences overlay container |
| `src/components/SpaceSwitcher.tsx` | React | Space tabs / selector in Sidebar |
| `src/hooks/useSpaces.ts` | React | Space state management |
| `src/hooks/usePreferences.ts` | React | Preferences read/write |

### Modified Files

| File | Changes |
|------|---------|
| `src-tauri/src/config.rs` | Add `SpaceConfig`, `Preferences` structs; extend `NexusConfig` |
| `src-tauri/src/state.rs` | Add `split_app_id`, `split_ratio`, `active_space_id` to `AppState` |
| `src-tauri/src/commands/webview.rs` | Refactor `calc_webview_rect` for split view; read gap/radius from config |
| `src-tauri/src/lib.rs` | Register new commands; resize handler handles both panes |
| `src-tauri/capabilities/default.json` | Add `notification:default` |
| `src/hooks/useAppsConfig.ts` | `badgeAppIds: Set<string>` → `badgeMap: Map<string, number \| null>` |
| `src/App.tsx` | Add split divider element; wire SettingsPanel |
| `src/types.ts` | Add `SpaceConfig`, `Preferences` types |
| `src/components/Sidebar.tsx` | Add SpaceSwitcher, account_label display, unread count badge |
| `src/components/CommandPalette.tsx` | Add space-switch actions |

### No Changes Needed

| File | Reason |
|------|--------|
| `src-tauri/src/routing.rs` | Session isolation already correct for multi-account |
| `src-tauri/src/commands/config.rs` | `save_config` already handles any `NexusConfig` shape |
| `src/components/UpdateBanner.tsx` | Independent of all v2 features |
| `src/lib/configMutations.ts` | Mutation helpers extend naturally |

---

## Data Flow Changes

### Split View — Dual Webview Resize

```
Window resize event (lib.rs)
    ↓
if split_app_id is Some:
    calc primary rect (left half)
    calc secondary rect (right half)
    resize both webviews
else:
    calc_webview_rect (single, unchanged)
    resize active webview only
```

### Notification Bridge

```
Web app fires window.Notification("New message", ...)
    ↓
Injected init script intercepts Notification constructor
    ↓
__TAURI_INTERNALS__.invoke("send_notification", { appId, title, body })
    ↓
Rust: check if app is in background (active_app_id != app_id)
    ↓ (background only)
tauri-plugin-notification.show() → OS notification center
```

### Preferences → Webview Geometry

```
User changes gap slider in SettingsPanel
    ↓
React: invoke("save_config", { config: { ...config, preferences: { gap: 8 } } })
    ↓
Rust: persist to apps.json, update AppState.config
    ↓
React: invoke("apply_preferences")
    ↓
Rust: read new gap from config, calc new webview rects, resize active webview(s)
    ↓
macOS: re-apply corner radius via with_webview + setCornerRadius(new_radius)
```

---

## Build Order for v2.0

Dependencies flow from bottom to top:

```
Code Signing (CI-only, no deps, can start immediately)

Preferences
    └── requires: Polish (Settings panel container)
                  config.rs (Preferences struct)
                  webview.rs refactor (constants → config values)

Polish
    └── requires: nothing new (pure UI + unread count parsing)

Notifications
    └── requires: nothing new (webview init script + plugin)

Split View
    └── requires: calc_webview_rect refactor (also needed by Preferences)
                  lib.rs resize handler (also touched by Preferences)

Multi-Account
    └── requires: nothing new (config + UI only)

Spaces
    └── requires: config.rs SpaceConfig
                  state.rs active_space_id
                  new IPC commands
```

**Recommended phase order:**

1. **Multi-Account** — zero Rust changes needed, quick win, validates config extension pattern
2. **Notifications** — self-contained Rust plugin + init script, no interaction with other v2 features
3. **Polish** (unread count + toggle button) — no new IPC, pure frontend
4. **Spaces** — largest config+state change, unblocks Command Palette space actions
5. **Split View** — requires `calc_webview_rect` refactor; do after Spaces so space context is stable
6. **Preferences** — depends on Split View's webview.rs refactor (shared geometry code)
7. **Code Signing** — async task, certificates have lead time; start paperwork in parallel with Phase 1

---

## Critical Integration Constraints

### Constraint 1: Capabilities for New Commands

Any new `#[tauri::command]` that must be invocable from `app-*` webviews (specifically `send_notification`) must be listed in `capabilities/default.json`. The existing `"windows": ["main", "app-*"]` pattern already covers this — only the permission entry needs adding.

New commands invocable only from the shell (`main`) can go in either `default.json` or a new `shell-only.json` capability. Use a separate file if you want explicit separation between shell-only and shared commands.

### Constraint 2: Notification Init Script Timing

The `initialization_script` runs before any page JavaScript. The `Notification` constructor intercept must handle the case where the original `window.Notification` is undefined (some pages/browsers). The injected script must never throw — wrap everything in try/catch.

### Constraint 3: Split View and LRU Eviction

The split view secondary app MUST be excluded from LRU eviction. In `switch_app_impl`, the LRU eviction loop already guards against evicting `active_app_id`. Extend this to also guard `split_app_id`. A helper function `is_protected(id)` avoids repeating the condition.

### Constraint 4: Preferences Gap on macOS vs Other Platforms

The `GAP` constant is `#[cfg(target_os = "macos")] = 12.0` and `0.0` otherwise. When gap becomes user-configurable, the platform default becomes the initial value in `Preferences::default()`, not a Rust constant. The corner radius `setCornerRadius(12.0)` on macOS should track `preferences.border_radius`, but on Linux/Windows (no corner radius API), this call is behind `#[cfg(target_os = "macos")]` and reads from preferences too.

### Constraint 5: Spaces and Webview Label Compatibility

The existing `"app-*"` capability glob covers current webview labels. If Spaces uses a different label scheme (e.g., `work-app-gmail`), the capability must be updated. Recommended: keep `app-{app_id}` as the label regardless of space — since `app_id` must be unique across all spaces anyway (it is the session key), there is no collision. Space context is tracked in `AppState` only, not in the webview label. This is the simplest approach and requires no capability changes.

---

## Architecture Diagram — v2.0 Target State

```
┌─────────────────────────────────────────────────────────────────────┐
│                      OS Window (TAO / main)                         │
│                                                                     │
│  ┌────────────────┐  ┌─────────────────────────────────────────┐    │
│  │  Shell WebView │  │    App WebViews (WRY child webviews)    │    │
│  │  label: "main" │  │                                         │    │
│  │                │  │  ┌──────────┐ │gap│ ┌──────────┐       │    │
│  │  SpaceSwitcher │  │  │ primary  │       │ secondary│       │    │
│  │  Sidebar       │  │  │ app-{id} │       │ app-{id2}│       │    │
│  │  CmdPalette    │  │  │ (visible)│       │(split    │       │    │
│  │  SettingsPanel │  │  └──────────┘       │ visible) │       │    │
│  │                │  │  label: "app-*"  (hidden: cached)      │    │
│  └───────┬────────┘  └─────────────────────────────────────────┘    │
│          │ invoke() / eval(CustomEvent)                              │
├──────────┼──────────────────────────────────────────────────────────┤
│  Rust Core (Mutex<AppState>)                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ config: NexusConfig {                                        │    │
│  │   spaces[], apps[], groups[],                               │    │
│  │   preferences: { theme, accent, gap, radius }               │    │
│  │ }                                                            │    │
│  │ active_app_id   split_app_id   split_ratio                  │    │
│  │ active_space_id  sidebar_visible  lru_order                  │    │
│  │ webviews_created                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Commands: switch_app, switch_space, enter_split, exit_split,        │
│            send_notification, apply_preferences, save_config, ...   │
│                                                                      │
│  ~/.nexus/apps.json                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns (v2.0 specific)

### Anti-Pattern 1: Separate Webview Labels per Space

**What people do:** Use `{space_id}-app-{app_id}` as the webview label so the space is encoded in the label.

**Why it's wrong:** `app_id` is already globally unique (it is the session key). Two apps in different spaces cannot have the same `app_id` — sessions would collide. Encoding space in the label adds complexity with no benefit. The capability glob must be widened. The LRU pool logic becomes space-aware when it doesn't need to be.

**Do this instead:** Keep `app-{app_id}` labels. Track space context in `AppState.active_space_id`. Each space's active app is stored in `AppState` or config, not in the label.

### Anti-Pattern 2: Storing Preferences in a Separate File

**What people do:** Put preferences in `~/.nexus/preferences.json` separate from `apps.json`.

**Why it's wrong:** Nexus has a single-file config principle. Two files means two watchers, two read paths, two save paths, and two sources of truth to reconcile on startup. It also breaks the user expectation that copying `apps.json` to a new machine restores everything.

**Do this instead:** Add `preferences` as a nested object in `NexusConfig` with `#[serde(default)]`. Backward compatible — old `apps.json` files without a `preferences` key will use defaults.

### Anti-Pattern 3: Implementing Split View as a New Window

**What people do:** Open a second `WebviewWindow` and position the two windows side by side programmatically.

**Why it's wrong:** Two OS windows cannot be guaranteed to stay in sync (different window decorations, can be moved independently, title bar on each). The UX feel is wrong — it looks like two separate apps.

**Do this instead:** Keep split view as two child webviews inside the single main window, positioned side by side with a small gap. This is what the existing `add_child` / `set_position` / `set_size` API already supports.

### Anti-Pattern 4: Calling `requestPermission()` Eagerly for Notifications

**What people do:** Call `tauri-plugin-notification`'s `requestPermission()` at app startup so the prompt appears immediately.

**Why it's wrong:** macOS will show a notification permission prompt the first time any notification is requested. Prompting at startup (before any app has sent a notification) feels intrusive and leads to users denying it.

**Do this instead:** Let the Rust `send_notification` command trigger the permission request lazily on first use. The plugin handles this internally — no explicit `requestPermission()` call is needed in app code.

---

## Sources

- [Tauri Notification Plugin docs — v2.tauri.app](https://v2.tauri.app/plugin/notification/)
- [Tauri Notification JS Reference — v2.tauri.app](https://v2.tauri.app/reference/javascript/notification/)
- [Tauri Capabilities — v2.tauri.app](https://v2.tauri.app/security/capabilities/)
- [Tauri macOS Code Signing — v2.tauri.app](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri Windows Code Signing — v2.tauri.app](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri Webview struct docs — docs.rs/tauri](https://docs.rs/tauri/latest/tauri/webview/struct.Webview.html)
- [Capabilities per webview label bug — github.com/tauri-apps/tauri/issues/10317](https://github.com/tauri-apps/tauri/issues/10317)
- [Child webview permissions bug — github.com/tauri-apps/tauri/issues/10298](https://github.com/tauri-apps/tauri/issues/10298)
- [Tauri v2 Code Signing Guide (DEV Community)](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n)
- [macOS Notarization Production Guide (DEV Community)](https://dev.to/0xmassi/shipping-a-production-macos-app-with-tauri-20-code-signing-notarization-and-homebrew-mc3)

---

*Architecture research for: Nexus v2.0 — Spaces, Multi-Account, Split View, Notifications, Polish, Preferences, Code Signing*
*Researched: 2026-03-20*

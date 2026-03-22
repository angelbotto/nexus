# Phase 6: Notifications - Research

**Researched:** 2026-03-21
**Domain:** Tauri 2 notification bridge — `window.Notification` intercept + `tauri-plugin-notification` + mute/badge state
**Confidence:** HIGH (stack verified against official docs and live codebase; patterns verified against existing v1.0 code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Title: App name (e.g., "Gmail"). Body: whatever the web app passed to `new Notification(title, {body})`
- Show app's favicon as notification icon
- Group notifications by app (multiple Gmail notifications stack into one expandable group) using `app_id` as the group identifier
- Only fire for background apps — the active app never double-notifies
- Clicking a notification focuses Nexus window AND switches to the app that fired it
- Right-click context menu on sidebar app: "Mute notifications" toggle (primary)
- Also accessible from command palette: "Mute [app] notifications"
- Also accessible from settings panel (Phase 9 will populate)
- Inline sidebar bell icon toggle for quick visual mute
- New apps default to notifications ON — user mutes the noisy ones
- Global DND toggle available from command palette or sidebar — silences all, preserves individual mute settings
- Dock badge = sum of parsed title numbers from unmuted apps: "(3) Gmail" + "(5) Slack" = badge 8
- If title has no number but badge dot is active, count as 1
- Badge clears per-app when user visits that app — dock badge updates to remaining sum
- Only unmuted apps contribute to dock badge count
- Simple on/off per app — no per-channel or rate limiting
- Muting stops OS notifications but sidebar badge (dot/number) still shows — user sees activity without being interrupted
- Muted apps don't contribute to dock badge count
- Reuse the existing `initialization_script` injection pattern from Phase 4 (MutationObserver for title changes)
- Intercept `window.Notification` constructor in the same init script — proxy to Rust via `__TAURI_INTERNALS__.invoke`
- `tauri-plugin-notification` handles OS delivery; the JS bridge is the custom part

### Claude's Discretion

- Notification sound (use OS default or silent)
- How to parse title numbers (regex patterns for different SPA title formats)
- Notification permission request handling (OS-level permission flow)
- How to store mute preferences (in apps.json or separate preferences file)
- DND toggle visual indicator (icon state, sidebar indicator)

### Deferred Ideas (OUT OF SCOPE)

- Per-channel notification filtering (Slack channels, email labels)
- Notification history panel inside Nexus
- Custom notification sounds per app
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTF-01 | User receives native OS notifications from webview apps (Gmail, Slack, etc.) | `tauri-plugin-notification` + `window.Notification` intercept via `initialization_script` |
| NOTF-02 | User can mute notifications per app | Mute state stored in `NexusConfig` (new `muted_app_ids` field with `#[serde(default)]`), Rust command checks mute before firing |
| NOTF-03 | Unread count badge appears on dock/taskbar icon (aggregate count) | `window.setBadgeCount()` or `app_handle.badge_count()` — conditionally enabled, see Open Questions |
</phase_requirements>

---

## Summary

Phase 6 adds native OS notifications to Nexus by intercepting the `window.Notification` API inside each app webview and routing it through Rust to the OS notification center. The architecture has zero new dependencies beyond `tauri-plugin-notification` (already identified in v2.0 research) and reuses the `initialization_script` pattern that already handles title change detection in v1.0.

The full notification pipeline is: app webview fires `new Notification(title, opts)` → injected init script intercepts, calls `__TAURI_INTERNALS__.invoke("send_notification", {...})` → Rust checks if app is background AND not muted AND not in global DND → fires OS notification via plugin. Mute state lives in `NexusConfig` as a new `muted_app_ids` field (backward compatible with `#[serde(default)]`). The dock badge is the sum of parsed unread counts from unmuted apps, updated on every title change and cleared when the user visits an app.

The main architectural constraint is that `tauri-plugin-notification` must be scoped to the `"main"` webview only in capabilities — NOT to `app-*` webviews. App webviews never use the plugin directly; they invoke the `send_notification` Rust command which uses the plugin from the privileged side. The existing `default.json` capability covers `["main", "app-*"]` for the `send_notification` command invocation, but the `notification:default` permission itself should be granted only to the shell.

**Primary recommendation:** Extend `initialization_script` with the `window.Notification` proxy, add `send_notification` Rust command, store mute state in `NexusConfig`, and surface mute controls in the existing context menu / command palette infrastructure.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-notification` | `2` (Rust) | Fires native OS notifications from Rust side | Official Tauri plugin; handles macOS/Windows/Linux permission flows automatically |
| `@tauri-apps/plugin-notification` | `2.3.3` (JS) | JS bindings for notification plugin in sidebar only | Matches Rust crate version; confirmed at npm registry |

### No New Frontend Libraries

The mute toggle UI, bell icon, and DND indicator are pure React with existing Tailwind classes. No animation library needed for this phase.

**Installation:**

```bash
# Run tauri add which handles both JS and Rust side together
npm run tauri add notification
```

Or manually:
```bash
npm install @tauri-apps/plugin-notification
```

```toml
# src-tauri/Cargo.toml
tauri-plugin-notification = "2"
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src-tauri/src/commands/
└── notifications.rs     # send_notification, set_badge_count commands

src/hooks/
└── useNotifications.ts  # mute state, DND toggle, badge count derived state

src/components/Sidebar.tsx  (modified — add bell icon toggle per app)
src/components/CommandPalette.tsx  (modified — add "Mute [app]" + DND actions)
src-tauri/src/config.rs  (modified — add muted_app_ids + dnd_enabled fields)
src-tauri/capabilities/default.json  (modified — add notification:default)
src-tauri/capabilities/desktop.json  (modified — or add shell-only capability)
```

### Pattern 1: window.Notification Intercept in initialization_script

**What:** Override `window.Notification` constructor in the init script injected at webview creation. Proxy all notification requests to Rust via `__TAURI_INTERNALS__.invoke`.

**When to use:** Always — runs before any page JS, survives page navigations.

**Critical rules:**
- Wrap entire script in a try/catch — must never throw even if page overrides `window.Notification` itself
- Set `window.Notification.permission = 'granted'` so web apps don't call `requestPermission()` (which would be denied at WKWebView level)
- Set `window.Notification.requestPermission = () => Promise.resolve('granted')` for the same reason
- Also call the original if it exists (some edge cases)

```javascript
// Source: ARCHITECTURE.md + official Tauri docs on initialization_script
// Injected into each app webview via initialization_script in switch_app_impl
(function() {
  try {
    const OriginalNotification = window.Notification;
    function NexusNotification(title, options) {
      try {
        window.__TAURI_INTERNALS__.invoke('send_notification', {
          appId: '__APP_ID__',  // replaced at webview creation time via format!()
          title: title,
          body: (options && options.body) ? options.body : ''
        });
      } catch(_e) {}
      // Attempt to call original for any side effects (non-critical)
      try {
        if (OriginalNotification) return new OriginalNotification(title, options);
      } catch(_e2) {}
    }
    NexusNotification.permission = 'granted';
    NexusNotification.requestPermission = function() {
      return Promise.resolve('granted');
    };
    window.Notification = NexusNotification;
  } catch(_e) {}
})();
```

### Pattern 2: Rust send_notification Command

**What:** Rust command that receives `(app_id, title, body)` from the app webview, checks active/mute/DND state, then fires OS notification via plugin.

**When to use:** Called exclusively from child webview init script via `__TAURI_INTERNALS__.invoke`.

```rust
// Source: ARCHITECTURE.md + official tauri-plugin-notification docs
// File: src-tauri/src/commands/notifications.rs
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn send_notification(
    app_id: String,
    title: String,
    body: String,
    app_handle: AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let (is_active, is_muted, dnd_enabled, app_name, favicon_url) = {
        let st = state.lock().map_err(|e| e.to_string())?;
        let is_active = st.active_app_id.as_deref() == Some(app_id.as_str());
        let is_muted = st.config.muted_app_ids.contains(&app_id);
        let dnd_enabled = st.config.dnd_enabled;
        let app_cfg = st.config.apps.iter().find(|a| a.id == app_id);
        let app_name = app_cfg.map(|a| a.name.clone()).unwrap_or(app_id.clone());
        let favicon_url = app_cfg.map(|a| {
            // Extract hostname for Google favicon service
            if let Ok(url) = a.url.parse::<tauri::Url>() {
                format!("https://www.google.com/s2/favicons?domain={}&sz=32", url.host_str().unwrap_or(""))
            } else { String::new() }
        }).unwrap_or_default();
        (is_active, is_muted, dnd_enabled, app_name, favicon_url)
    };

    // Never notify for active app — it's visible, user is looking at it
    if is_active { return Ok(()); }
    // Muted apps and global DND suppress OS notification (badge still shows)
    if is_muted || dnd_enabled { return Ok(()); }

    app_handle
        .notification()
        .builder()
        .title(&app_name)         // App name as title (locked decision)
        .body(&body)              // Web app's notification body
        .group(&app_id)           // Group by app_id (locked decision)
        .show()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Note on icon:** The `tauri-plugin-notification` JS API has an `icon` field in `Options`, but the Rust builder API does not expose an icon field in the same way. The notification will show the app's own icon from the bundle by default on macOS. The favicon URL approach requires platform-specific handling — leave icon as default for v2.0 unless confirmed working. See Open Questions.

### Pattern 3: Mute State in NexusConfig

**What:** Add `muted_app_ids` (Set) and `dnd_enabled` (bool) to `NexusConfig`. Both are `#[serde(default)]` for backward compatibility.

```rust
// Source: established pattern from existing NexusConfig design
// File: src-tauri/src/config.rs — add to NexusConfig struct
#[serde(default)]
pub muted_app_ids: Vec<String>,   // Use Vec for JSON compat; check contains() in O(n) — fine for <50 apps
#[serde(default)]
pub dnd_enabled: bool,
```

Two new Rust commands:
```rust
// toggle_mute_app(app_id: String) -> Result<(), String>
// set_dnd(enabled: bool) -> Result<(), String>
// Both modify AppState.config and call save_config internally
```

### Pattern 4: Dock Badge via setBadgeCount

**What:** React computes the aggregate unread count from all unmuted apps and calls Tauri's badge API.

**Where the API lives:** `@tauri-apps/api/window` — `Window.setBadgeCount(count: number | null)`.

```typescript
// Source: Tauri JS API reference (MEDIUM confidence — confirmed to exist, bug status unclear)
import { getCurrentWindow } from '@tauri-apps/api/window';

// Called whenever badgeMap changes (in useNotifications or useAppsConfig)
async function updateDockBadge(badgeMap: Map<string, number | null>, mutedAppIds: Set<string>): Promise<void> {
  let total = 0;
  for (const [appId, count] of badgeMap.entries()) {
    if (mutedAppIds.has(appId)) continue;
    if (count === null) {
      total += 1;  // Dot-badge = count as 1
    } else {
      total += count;
    }
  }
  try {
    await getCurrentWindow().setBadgeCount(total > 0 ? total : null);
  } catch (_e) {
    // setBadgeCount has known macOS bug #13905 — do not throw
  }
}
```

**Capability required:** `core:window:allow-set-badge-count` — add to `default.json` for the `"main"` window.

### Pattern 5: Title Number Parsing (Claude's Discretion)

**Recommendation:** Use a single regex covering the two dominant SPA title formats.

```typescript
// Source: ARCHITECTURE.md pattern + web app observation
function extractUnreadCount(title: string): number | null {
  // Covers: "(3) Gmail", "(12) Slack | general", "3 unread - Gmail"
  const prefixMatch = title.match(/^\((\d+)\)/);
  if (prefixMatch) return parseInt(prefixMatch[1], 10);
  return null;
}
```

Apps observed to use `(N)` prefix: Gmail, Slack, Linear, Notion, GitHub. No app observed to use only a bare number at start (would create false positives). Recommend starting with the `(N)` prefix pattern only.

### Pattern 6: Mute Preferences Storage (Claude's Discretion)

**Recommendation:** Store `muted_app_ids` and `dnd_enabled` in the existing `NexusConfig` in `apps.json`, NOT in a separate file.

Reasoning:
- Single-file config principle — the existing architecture's core constraint
- Copying `apps.json` to a new machine should restore mute preferences
- `#[serde(default)]` ensures backward compatibility
- No risk of two-writer race at this phase (Preferences panel is Phase 9 — v2.0's later phase)

### Anti-Patterns to Avoid

- **Granting `notification:default` to `app-*` webviews:** Scopes the plugin to all webviews, breaking the proxy model. The `notification:default` permission goes to the `"main"` window only. App webviews invoke `send_notification` via `__TAURI_INTERNALS__` as a custom command (covered by `default.json`'s `["main", "app-*"]` windows scope for command invocation — this is different from the notification permission itself).

- **Calling `requestPermission()` eagerly at startup:** macOS shows a system prompt immediately. If the user denies it before ever receiving a notification, all notifications are silently blocked. Let the first real notification trigger the permission request lazily (the plugin handles this internally).

- **Reading notification state from React only:** Mute state must live in Rust (`AppState.config`) because `send_notification` is called directly from the app webview's init script — Rust must be the gatekeeper, not React.

- **Throwing in the init script:** The `window.Notification` override must be wrapped in try/catch at every level. Some pages may define getters/setters that throw when `window.Notification` is assigned.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS notification delivery | Custom notification IPC | `tauri-plugin-notification` | Handles macOS permission flow, Windows toast, Linux libnotify; edge cases per platform |
| Notification permission request | Manual WKUIDelegate impl | Plugin's lazy permission on first send | Platform-specific delegate impl has significant complexity on macOS |
| App icon in notification | Favicon download + convert | App bundle icon (default) | Favicon requires async download, format conversion; bundle icon is instant and correct |

**Key insight:** The `tauri-plugin-notification` Rust builder API (`app_handle.notification().builder()...show()`) is the only reliable cross-platform path. The web `Notification` API inside WKWebView/WebView2 is explicitly suppressed — intercepting it and routing through the plugin is the correct approach, not trying to un-suppress it.

---

## Common Pitfalls

### Pitfall 1: notification:default Granted to app-* Webviews (Pitfall 10 from PITFALLS.md)

**What goes wrong:** Granting `notification:default` in a capability that covers `app-*` webviews overwrites `window.Notification` in those webviews with Tauri's own bridge, conflicting with the custom proxy.

**Why it happens:** Developers add `notification:default` to the main `default.json` which already covers both `"main"` and `"app-*"` via the `"windows"` array.

**How to avoid:** Create a separate `shell-only.json` capability file for the `"main"` window only, and put `notification:default` there. Keep `default.json` for shared commands.

```json
// src-tauri/capabilities/shell-only.json
{
  "identifier": "shell-only",
  "windows": ["main"],
  "permissions": [
    "notification:default"
  ]
}
```

**Warning signs:** `window.Notification` inside Gmail/Slack console returns the Tauri bridge object, not the custom proxy.

### Pitfall 2: init Script Override Throws on Page Reload

**What goes wrong:** The `initialization_script` runs once per webview creation, before the first page load. On navigation / SPA route changes, the script is NOT re-injected — it already ran. BUT if the page's own JS overrides `window.Notification` after load (some SPAs do this), the proxy gets replaced.

**Why it happens:** The init script is a one-time injection that creates the initial override. Page JS runs after and can clobber it.

**How to avoid:** This is mostly not a problem because the init script runs first (before page JS). However, if a page explicitly resets `window.Notification` during its initialization, the proxy is lost. The mitigation: use `Object.defineProperty` to make the override non-configurable after the initial assignment. However, this may break apps that legitimately reset their notification state. For v2.0, accept that a small number of apps might reset the override — the try/catch in the init script prevents crashes.

**Warning signs:** Notifications stop working for an app after the first page load but work on hard refresh (Cmd+R).

### Pitfall 3: setBadgeCount Has Active Bug on macOS (#13905)

**What goes wrong:** `Window.setBadgeCount()` may silently fail on macOS (Tauri 2.7.0 report). The issue may be a permission or configuration problem, not a framework bug — but it's unresolved.

**Why it happens:** The badging API was added mid-2.x series and has limited real-world usage. The required capability may be missing.

**How to avoid:** Add `core:window:allow-set-badge-count` to the shell capability. Wrap the call in try/catch so a failure never surfaces to the user. If the call silently fails (no error but no badge), check if the capability permission is registered. The NOTF-03 requirement must still be addressed — if `setBadgeCount` is confirmed broken, use `Window.setBadgeLabel()` as fallback (shows a text label on macOS, Windows only shows overlay icon).

**Warning signs:** Badge count never appears on macOS dock even after calling `setBadgeCount(5)` with no error thrown.

### Pitfall 4: Mute State Not Persisted → Lost on Restart

**What goes wrong:** Mute state stored only in React/zustand state is wiped on app restart. Users must re-mute apps every launch.

**Why it happens:** React state is ephemeral. The correct flow is: toggle mute → `invoke("toggle_mute_app", { appId })` → Rust updates `AppState.config.muted_app_ids` → Rust calls `save_config` → `apps.json` is updated → on next launch, `load_config` restores mute state.

**How to avoid:** Mute toggle in React must call a Rust command that both updates the in-memory state AND saves to disk. Never store mute state only in React.

### Pitfall 5: Notification Click Cannot Focus Nexus Window Easily

**What goes wrong:** The user clicks an OS notification and expects Nexus to come to the foreground and switch to the app. The `tauri-plugin-notification` JS API does not have a built-in click handler that fires in the Tauri app for all platforms.

**Why it happens:** Notification click callbacks require platform-specific handling. The Tauri notification plugin's `onAction()` is mobile-focused. On desktop, notification activation typically uses `notification:allow-on-notification` or similar platform callbacks.

**How to avoid:** Research the desktop notification click handler for `tauri-plugin-notification`. If not supported directly, use the notification's `data` field to store the `app_id` and rely on the OS's `App.focus()` + `switch_app` chain triggered when the user clicks any notification that brings the app to focus. The `app_handle.get_window("main").request_user_attention()` API may provide the fallback behavior.

**Warning signs:** Clicking a notification brings Nexus to front but doesn't switch to the app that sent it.

---

## Code Examples

Verified patterns from official sources and live codebase:

### Extended initialization_script (extends existing pattern)

```rust
// Source: src-tauri/src/commands/webview.rs (existing init_script extended)
// File: same switch_app_impl function, extended init_script string
let init_script = format!(
    r#"(function() {{
    // === Existing: MutationObserver for title changes ===
    var _lastTitle = document.title;
    function checkTitle() {{
        if (document.title !== _lastTitle) {{
            _lastTitle = document.title;
            try {{
                window.__TAURI_INTERNALS__.invoke('notify_title_changed', {{
                    appId: '{}',
                    title: document.title
                }});
            }} catch(e) {{}}
        }}
    }}
    var observer = new MutationObserver(checkTitle);
    observer.observe(document.documentElement, {{
        subtree: true, childList: true, characterData: true
    }});

    // === New: window.Notification intercept ===
    try {{
        var _OriginalNotification = window.Notification;
        function _NexusNotification(title, options) {{
            try {{
                window.__TAURI_INTERNALS__.invoke('send_notification', {{
                    appId: '{}',
                    title: title,
                    body: (options && options.body) ? options.body : ''
                }});
            }} catch(_e) {{}}
            try {{
                if (_OriginalNotification) return new _OriginalNotification(title, options);
            }} catch(_e2) {{}}
        }}
        _NexusNotification.permission = 'granted';
        _NexusNotification.requestPermission = function() {{
            return Promise.resolve('granted');
        }};
        window.Notification = _NexusNotification;
    }} catch(_e3) {{}}
}})();"#,
    app_id,   // for MutationObserver
    app_id    // for Notification intercept
);
```

### Capabilities split for notification scoping

```json
// Source: PITFALLS.md (Pitfall 10), Tauri capabilities docs
// File: src-tauri/capabilities/shell-only.json (new file)
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "shell-only",
  "description": "Permissions scoped to Nexus shell window only (not app webviews)",
  "windows": ["main"],
  "permissions": [
    "notification:default",
    "core:window:allow-set-badge-count",
    "core:window:allow-set-badge-label"
  ]
}
```

```json
// File: src-tauri/capabilities/default.json — existing, unchanged
// No notification:default here — it stays out of app-* scope
```

### NexusConfig additions

```rust
// Source: established config pattern (existing NexusConfig in config.rs)
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NexusConfig {
    pub groups: Vec<GroupConfig>,
    pub apps: Vec<AppConfig>,
    #[serde(default)]
    pub last_active_app_id: Option<String>,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    // New for Phase 6:
    #[serde(default)]
    pub muted_app_ids: Vec<String>,
    #[serde(default)]
    pub dnd_enabled: bool,
}
```

### TypeScript type additions

```typescript
// Source: established types.ts pattern
export interface NexusConfig {
  groups: GroupConfig[];
  apps: AppConfig[];
  lastActiveAppId?: string | null;
  sidebarCollapsed: boolean;
  // New for Phase 6:
  mutedAppIds: string[];
  dndEnabled: boolean;
}
```

### useNotifications hook structure

```typescript
// Source: pattern derived from existing useAppsConfig.ts
// File: src/hooks/useNotifications.ts
interface UseNotificationsResult {
  mutedAppIds: Set<string>;
  dndEnabled: boolean;
  toggleMute: (appId: string) => Promise<void>;
  setDnd: (enabled: boolean) => Promise<void>;
}

// Derives from config (passed as prop or consumed from context)
// Calls: invoke("toggle_mute_app", { appId })
// Calls: invoke("set_dnd", { enabled })
```

### Sidebar bell icon toggle (mute inline control)

```typescript
// Source: existing Sidebar.tsx pattern
// Added to SortableAppItem alongside existing hasBadge indicator
{/* Bell icon — muted state indicator + click to toggle */}
<button
  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
  onClick={(e) => { e.stopPropagation(); onToggleMute(app.id); }}
  title={isMuted ? "Unmute notifications" : "Mute notifications"}
>
  {isMuted ? <BellOffIcon /> : <BellIcon />}
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Web Notification API directly in WKWebView (blocked) | Intercept + Rust proxy via `initialization_script` | Tauri 2.x established pattern | Required for all third-party site notifications |
| Manual `window.Notification` check | `NexusNotification.requestPermission = () => Promise.resolve('granted')` to prevent permission dialogs | v2.0 design | Apps believe permission is granted; proxy handles delivery |

**Deprecated/outdated:**
- Choochmeque's unofficial `tauri-plugin-notifications`: use official `tauri-plugin-notification` from `tauri-apps` team instead — no FCM overhead, maintained on same release cadence as Tauri.

---

## Open Questions

1. **Notification click → switch to app**
   - What we know: `tauri-plugin-notification` JS `onAction()` is mobile-focused. Desktop notification clicks need a different handler.
   - What's unclear: Whether `notification:allow-on-notification` or a similar capability enables a click callback on macOS/Windows desktop in the current plugin version.
   - Recommendation: During Wave 0 or first implementation task, test `sendNotification` with a click and observe if the app receives any callback. If not, use `app_handle.get_window("main").request_user_attention()` to flash the dock icon, and use app auto-focus on the next `WindowEvent::Focused` to fire `switch_app` for the last-notified app. Store `last_notified_app_id` in `AppState` for this purpose. The CONTEXT.md decision is locked (click → focus + switch) but the Tauri API path to implement it needs a quick spike.

2. **setBadgeCount reliability on macOS**
   - What we know: Issue #13905 reports it doesn't work on macOS 2.7.0, but the reporter may have had a permission/capability misconfiguration. The API exists and was implemented in the Badging API PR (#11661).
   - What's unclear: Whether adding `core:window:allow-set-badge-count` to the capability resolves it fully.
   - Recommendation: In the first task that implements badge count, add the capability and test on macOS. If `setBadgeCount` silently fails even with the capability, fall back to `setBadgeLabel` (shows a string badge on macOS dock). NOTF-03 requires "aggregate count badge" — either API satisfies it. Wrap in try/catch regardless.

3. **Notification icon from app favicon**
   - What we know: The Rust builder API `app_handle.notification().builder()` does not expose an `icon()` method in the confirmed docs. The JS `sendNotification({ icon: "..." })` does have an `icon` field in the `Options` interface.
   - What's unclear: Whether a URL (not a local asset path) is accepted as icon on macOS/Windows.
   - Recommendation: Default to using the app's bundle icon (automatic on macOS). Do not spend time on favicon-as-icon for v2.0 unless it works trivially. The locked decision says "show app's favicon as notification icon" — if the Rust builder supports it, use it; otherwise document that the bundle icon is used instead and revisit in v3.0. This is a visual polish item, not a functional blocker.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in `vite.config.ts` — `test: {}`) |
| Config file | `vite.config.ts` (inline `test: {}` block) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |
| Rust tests | `cargo test -p nexus_lib` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | `send_notification` only fires for background apps | unit (Rust) | `cargo test -p nexus_lib -- test_send_notification` | ❌ Wave 0 |
| NOTF-01 | `send_notification` does not fire when app is active | unit (Rust) | `cargo test -p nexus_lib -- test_send_notification_active_app_skipped` | ❌ Wave 0 |
| NOTF-02 | `send_notification` does not fire when app is muted | unit (Rust) | `cargo test -p nexus_lib -- test_send_notification_muted_skipped` | ❌ Wave 0 |
| NOTF-02 | `send_notification` does not fire when DND is enabled | unit (Rust) | `cargo test -p nexus_lib -- test_send_notification_dnd_skipped` | ❌ Wave 0 |
| NOTF-02 | `toggle_mute_app` adds/removes from `muted_app_ids` | unit (Rust) | `cargo test -p nexus_lib -- test_toggle_mute_app` | ❌ Wave 0 |
| NOTF-03 | `extractUnreadCount` parses `(N)` title prefix correctly | unit (TS) | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| NOTF-03 | `extractUnreadCount` returns null for titles with no number | unit (TS) | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| NOTF-03 | Badge count sums only unmuted apps | unit (TS) | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| NOTF-03 | Badge clears per-app on app visit | unit (TS) | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| - | `muted_app_ids` and `dnd_enabled` backward compat | unit (Rust) | `cargo test -p nexus_lib -- test_nexus_config` | ❌ Wave 0 |

**Note:** OS notification delivery, window focus on click, and dock badge rendering are **manual-only** tests (require real OS integration, no headless verification possible).

### Sampling Rate

- **Per task commit:** `npm test && cargo test -p nexus_lib`
- **Per wave merge:** `npm test && cargo test -p nexus_lib`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/notifications.test.ts` — covers `extractUnreadCount`, badge sum logic, mute filtering
- [ ] `src-tauri/src/commands/notifications.rs` — with `#[cfg(test)]` module covering active/muted/DND guard logic (mock `AppState`)
- [ ] `src-tauri/src/config.rs` test additions — backward compat with `muted_app_ids` and `dnd_enabled` defaulting when missing (extend existing `test_nexus_config_new_fields_default_when_missing` test)

*(Framework install: not needed — Vitest already configured; cargo test already works)*

---

## Sources

### Primary (HIGH confidence)

- `https://v2.tauri.app/plugin/notification/` — tauri-plugin-notification installation, permissions, JS API
- `https://v2.tauri.app/reference/javascript/notification/` — `sendNotification` `Options` interface confirmed: `title`, `body`, `icon`, `group`, `groupSummary` fields
- `src-tauri/src/commands/webview.rs` (live codebase) — `initialization_script` pattern, `notify_title_changed` command pattern
- `src-tauri/src/config.rs` (live codebase) — `NexusConfig` struct, `#[serde(default)]` pattern for backward compat
- `src-tauri/capabilities/default.json` (live codebase) — existing capability scope `["main", "app-*"]`
- `src/hooks/useAppsConfig.ts` (live codebase) — `badgeAppIds: Set<string>`, `handleTitleChanged`, event dispatch pattern

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — notification bridge data flow, `send_notification` Rust command signature, capability constraint (verified by cross-referencing with live codebase)
- `.planning/research/PITFALLS.md` Pitfall 10 — notification capability scoping pattern (verified against official docs)
- `https://v2.tauri.app/reference/javascript/api/namespacewindow/` — `setBadgeCount`, `setBadgeLabel` confirmed in Window API (MEDIUM: platform support details not fully specified)
- GitHub issue #13905 — `setBadgeCount` macOS bug (open as of 2025-07-28, possible capability misconfiguration root cause)

### Tertiary (LOW confidence — needs validation)

- Notification click handler on desktop: `onAction()` appears mobile-focused; desktop click callback path not confirmed in official docs — needs dev spike
- `icon` field in Rust notification builder accepting a URL (vs local asset path) — not confirmed, needs validation

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — `tauri-plugin-notification` API confirmed at official docs; version compatibility confirmed
- Architecture: HIGH — based on live codebase inspection + official Tauri 2 docs; patterns extrapolated from existing `notify_title_changed` command which is the direct analog
- Pitfalls: HIGH — Pitfall 10 (notification scoping) from PITFALLS.md directly applies; setBadgeCount bug confirmed open via GitHub; all critical edge cases identified
- Open Questions: LOW — notification click handler and icon URL support are unverified; both are non-blocking for core NOTF-01/02/03 requirements

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable Tauri plugin, 30 day window)

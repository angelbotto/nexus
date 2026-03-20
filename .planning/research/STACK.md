# Stack Research

**Domain:** Tauri 2 desktop browser / multi-webview unified web-app launcher
**Researched:** 2026-03-20 (v2.0 addendum — extends 2026-03-18 v1.0 research)
**Confidence:** MEDIUM-HIGH (notification relay pattern MEDIUM; multiwebview split view MEDIUM due to active bugs; signing env vars HIGH)

---

> **Scope note:** This file covers ONLY what is new for v2.0 (Spaces, Multi-Account, Split View, Notifications, Polish, Preferences, Code Signing). The v1.0 stack (Tauri 2, React 18, TypeScript, Vite, Tailwind CSS, zustand, dnd-kit, fuse.js) remains valid and unchanged. Do not re-install or replace those packages.

---

## New Dependencies for v2.0

### Tauri Plugins (Rust + JS)

| Plugin | Rust Crate | JS Package | Version | Feature |
|--------|-----------|------------|---------|---------|
| `tauri-plugin-notification` | `tauri-plugin-notification = "2"` | `@tauri-apps/plugin-notification` | `2.3.3` | Native OS notifications from webview apps |
| `tauri-plugin-store` | `tauri-plugin-store = "2"` | `@tauri-apps/plugin-store` | `2.4.2` | Persistent preferences storage (themes, border-radius, gaps) |

### Frontend Libraries

| Library | Version | Purpose | Feature |
|---------|---------|---------|---------|
| `motion` | `12.38.0` | Smooth animations for sidebar, transitions, split view drag handles | Polish — animations |

No other new frontend dependencies are needed. Spaces and Multi-Account are pure state + config additions (zustand slices + JSON schema changes). Split View uses existing Tauri Webview positioning APIs.

---

## Feature-by-Feature Stack Decisions

### Spaces (independent app sets per workspace context)

**No new dependencies.** Spaces are a config-schema change plus a new zustand slice.

- Extend `~/.nexus/apps.json` schema: add top-level `spaces: Space[]` array, each `Space` has `id`, `name`, `appIds[]`
- Add `activeSpaceId` to zustand store
- Existing `@tauri-apps/plugin-fs` handles the extended JSON — no additional plugin needed
- Sidebar renders apps filtered by `activeSpaceId`

**Why not tauri-plugin-store here:** Spaces config is structural (large nested JSON). tauri-plugin-store's key-value API is better suited for flat preferences. Keep structural config in `apps.json` via plugin-fs.

### Multi-Account (same app, multiple isolated sessions)

**No new dependencies.** Session isolation already works via `data_store_identifier` / `WebviewWindowBuilder::data_directory`.

- Extend `App` schema: add `accounts: Account[]`, each with `id`, `label`, `sessionDir` (e.g., `~/.nexus/sessions/{appId}/{accountId}/`)
- Each account's WebviewWindow gets a distinct `data_directory` pointing to its session dir
- Sidebar item renders sub-items or a switcher per account
- State tracked in zustand `accountStore` slice

**Platform note:** On macOS, `data_store_identifier` on WKWebView isolates cookies/credentials. On Windows/Linux, a distinct `dataDirectory` path achieves the same. Both are available in Tauri 2's `WebviewWindowBuilder` — verified in existing v1 architecture.

### Split View (two apps side by side)

**No new dependencies, but requires enabling the `unstable` Tauri feature flag.**

The Tauri `Webview` API (stable JS methods: `setPosition()`, `setSize()`, `setAutoResize()`) can position two webviews side by side in the main window. However, multi-webview in a single window still requires `features = ["unstable"]` in `Cargo.toml`.

**Active bugs as of March 2026 (MEDIUM confidence — GitHub issues):**
- `#11376`: Only last child webview renders on some builds
- `#10420`: Broken positioning on Linux
- `#13071`: Linux layout error — webviews stack vertically instead of respecting x/y
- `#12568`: `WindowEvent::Focused` never fires when unstable enabled
- `#13582`: Tauri API import fails in second webview on some configs

**Recommended implementation approach:**
- Use the existing `WebviewWindow` show/hide pattern for v2.0 split view initially
- Split the main window visually: left half = WebviewWindow A bounds, right half = WebviewWindow B bounds
- Resize both WebviewWindows reactively when the window resizes (listen to `window.resized` Tauri event)
- This avoids the `unstable` flag entirely and the associated bugs

**If multiwebview bugs are fixed before ship:** Switch to embedded `Webview` objects with `x/y/width/height` — the API is identical; only the creation path differs.

**No third-party split view library needed.** The drag handle divider is a simple CSS/React component (two divs, a draggable separator, `onMouseMove` to adjust widths).

### Native Notifications

**Add:** `tauri-plugin-notification` (Rust + JS).

Webview apps (Gmail, Slack, Linear) use the browser `Notification` API internally. The strategy:

1. Install `tauri-plugin-notification` — gives you `sendNotification()` from Rust and JS
2. Inject an initialization script into each app webview that overrides `window.Notification` and proxies calls to `invoke('send_notification', { title, body })`
3. The Rust command calls `tauri_plugin_notification::NotificationExt::notification()` to fire native OS notifications
4. Request permission once at startup using `requestPermission()` from `@tauri-apps/plugin-notification`

**Why this approach:** The browser Notification API inside a Tauri webview renders notifications from the webview's context, not the OS. On macOS, WKWebView suppresses `Notification` by default unless the app has `NSUserNotificationUsageDescription` in its Info.plist. Intercepting via initialization script and routing through the Tauri plugin is the reliable cross-platform path.

**Confidence:** MEDIUM — the injection pattern is supported (Tauri docs confirm `initialization_script` survives page changes), but the exact override implementation needs validation in dev. The `tauri-plugin-notification` API itself is HIGH confidence.

### Polish — Animations

**Add:** `motion` (formerly Framer Motion) `^12.38.0`.

Import from `motion/react` (new package name since the rebrand). Compatible with React 18+ (Nexus uses React 18.3.1).

Use for:
- Sidebar collapse/expand (`AnimatePresence` + `motion.div` with `width` animation)
- Space switcher tab transitions
- Split view resize handle tooltip
- Settings panel slide-in
- Activity badge pulse

**Why motion over CSS transitions:** WebviewWindows are native OS windows — CSS in the React shell cannot animate them. Motion animates only the sidebar/chrome React UI, which is the correct scope. For cross-webview transitions (switching apps), continue using native `show()`/`hide()` (instant, no CSS can reach that layer).

**Why not react-spring:** motion is maintained by the same team that powers Framer's animation engine, has 30M+ npm downloads/month, and the API is more declarative for layout animations (which Spaces/sidebar needs). react-spring's physics model adds complexity without benefit here.

### Preferences — Theme Customization

**Add:** `tauri-plugin-store` `^2.4.2`.

Preferences (border-radius, accent color, gap size, dark/light theme) are flat key-value pairs — exactly what plugin-store is designed for.

- Store creates `~/.nexus/prefs.json` automatically (or a named store path)
- `LazyStore` API: loads on first access, auto-saves on mutation
- Expose a `usePreferences()` React hook that wraps the store's get/set
- Apply preferences as CSS custom properties on `:root` (e.g., `--nx-radius: 8px`) — Tailwind v4 CSS-first config reads them natively

**Why tauri-plugin-store instead of plugin-fs for preferences:** plugin-store provides reactive updates (JS `onChange` listener), auto-save on every set, and a typed API without manual JSON parsing. For flat settings this is the right abstraction. Keep `apps.json` structural config in plugin-fs.

**Tailwind v4 CSS custom properties pattern:**

```css
/* index.css */
:root {
  --nx-radius: var(--pref-radius, 8px);
  --nx-accent: var(--pref-accent, #6366f1);
}
```

Preferences update `document.documentElement.style.setProperty('--pref-radius', value)` — zero framework overhead, instant visual update.

### Code Signing

**No new npm/cargo dependencies.** Code signing is purely CI/CD configuration using environment variables that Tauri's bundler reads automatically.

**macOS (Developer ID + Notarization):**
```
APPLE_CERTIFICATE          # base64-encoded .p12 file
APPLE_CERTIFICATE_PASSWORD # .p12 export password
APPLE_SIGNING_IDENTITY     # e.g. "Developer ID Application: Name (TEAMID)"
APPLE_API_ISSUER           # App Store Connect API issuer ID (preferred over Apple ID)
APPLE_API_KEY              # Key ID from App Store Connect
APPLE_API_KEY_PATH         # Path to downloaded .p8 private key
```

`tauri.conf.json` addition:
```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": null
    }
  }
}
```
(Set to `null` to let `APPLE_SIGNING_IDENTITY` env var override per environment.)

**Windows (OV Certificate — recommended for indie/small team):**
```
WINDOWS_CERTIFICATE          # base64-encoded .pfx file
WINDOWS_CERTIFICATE_PASSWORD # .pfx password
```

Azure Key Vault is an alternative if you already have Azure infrastructure, but introduces a hard dependency on Azure for every build. OV certificate is simpler for a personal project.

**Important:** Windows OV certificates will still show Microsoft SmartScreen warnings initially. SmartScreen suppression requires reputation built over time (hundreds of downloads with no malware reports). This is expected behavior — not a bug in the signing setup.

**GitHub Actions integration:** `tauri-apps/tauri-action@v0` reads all the above environment variables automatically when set as repository secrets. No custom signing scripts required.

---

## Installation (v2.0 additions only)

```bash
# Frontend
npm install motion

# Tauri plugin JS bindings
npm install @tauri-apps/plugin-notification @tauri-apps/plugin-store
```

```toml
# src-tauri/Cargo.toml — add to [dependencies]
tauri-plugin-notification = "2"
tauri-plugin-store = "2"
```

```rust
// src-tauri/src/lib.rs — add to builder
tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    // ...existing plugins
```

```json
// src-tauri/capabilities/default.json — add permissions
{
  "permissions": [
    "notification:default",
    "store:default"
  ]
}
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `motion` (motion.dev) | `framer-motion` | Same library — `framer-motion` is the legacy package name. Import from `motion/react` with the `motion` package. `framer-motion` still works but is deprecated. |
| `motion` | `react-spring` | Physics-based spring model is overkill for sidebar/panel animations. motion's declarative API is faster to implement and easier to maintain. |
| `tauri-plugin-store` for preferences | Extend `apps.json` with preferences | Mixing structural config (apps/spaces) with flat UI preferences in one file causes schema churn and complicates migrations. Separate concerns. |
| `tauri-plugin-store` for preferences | `localStorage` | localStorage is unreliable across multiple WebviewWindows on Linux (known Tauri bug #10981 from v1 research). |
| WebviewWindow bounds for split view | multiwebview `unstable` flag | Multiple active bugs on Linux and Windows as of March 2026. The WebviewWindow bounds approach achieves the same visual result without the unstable API. |
| Notification injection script | Third-party `tauri-plugin-notifications` (Choochmeque) | Official `tauri-plugin-notification` is maintained by tauri-apps team, follows same versioning, has no FCM/APNs overhead. The unofficial plugin adds complexity without benefit for desktop-only. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tauri = { features = ["unstable"] }` for split view | Active rendering/positioning bugs on Linux and Windows (#11376, #10420, #13071) as of March 2026 | WebviewWindow bounds approach — position two OS windows to cover left and right halves of main window area |
| `react-transition-group` | Outdated; motion covers all animation needs with a better API | `motion` |
| `notistack` / `react-toastify` | In-app notification toasts are a separate concern from OS-level notifications. Don't conflate the two. Nexus needs OS notifications, not in-app toasts. | `tauri-plugin-notification` for OS-level; plain React state for in-app status messages |
| Global CSS `transition` on webview container | The webview content area is a native OS window — CSS in the React shell cannot animate it | Accept instant show/hide; animate only the sidebar chrome with `motion` |

---

## Version Compatibility (v2.0 additions)

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `motion@12.38.0` | React `^18.0.0 \|\| ^19.0.0` | Peer dep satisfied by Nexus's React 18.3.1 |
| `@tauri-apps/plugin-notification@2.3.3` | Tauri `2.x` | Plugin major must match Tauri major — already on Tauri 2 |
| `@tauri-apps/plugin-store@2.4.2` | Tauri `2.x` | Same versioning rule |
| `tauri-plugin-notification@2` (Rust) | `tauri = "2"` | Matches existing Cargo.toml |
| `tauri-plugin-store@2` (Rust) | `tauri = "2"` | Matches existing Cargo.toml |

---

## Sources

- https://v2.tauri.app/plugin/notification/ — tauri-plugin-notification installation, permissions (HIGH confidence)
- https://v2.tauri.app/reference/javascript/notification/ — JS API confirmed at `@tauri-apps/plugin-notification@2.3.3` (HIGH confidence)
- https://v2.tauri.app/plugin/store/ — tauri-plugin-store `LazyStore` API, auto-save behavior (HIGH confidence)
- https://v2.tauri.app/reference/javascript/api/namespacewebview/ — `setPosition()`, `setSize()`, `setAutoResize()` confirmed stable in Webview API (HIGH confidence)
- https://v2.tauri.app/distribute/sign/macos/ — macOS signing env vars, App Store Connect API method (HIGH confidence)
- https://v2.tauri.app/distribute/sign/windows/ — Windows OV certificate env vars, Azure Key Vault alternative (HIGH confidence)
- https://motion.dev/docs/react — `motion` package, import from `motion/react`, React 18/19 compatibility (HIGH confidence)
- https://motion.dev/docs/react-installation — `npm install motion` confirmed (HIGH confidence)
- GitHub issues #11376, #10420, #13071, #12568, #13582 — Active multiwebview bugs as of March 2026 (HIGH confidence — direct issue evidence)
- npm registry — `motion@12.38.0`, `@tauri-apps/plugin-notification@2.3.3`, `@tauri-apps/plugin-store@2.4.2`, `zustand@5.0.12` verified live (HIGH confidence)
- WebSearch (notification injection pattern) — Tauri initialization_script survives page changes, confirmed in Tauri docs (MEDIUM confidence — pattern inferred from docs, not an official tutorial)

---

*Stack research for: Nexus v2.0 — Spaces, Multi-Account, Split View, Notifications, Polish, Preferences, Code Signing*
*Researched: 2026-03-20*

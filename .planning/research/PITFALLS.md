# Pitfalls Research

**Domain:** Tauri 2 multi-webview desktop app browser (web-app launcher with persistent sessions)
**Researched:** 2026-03-20 (updated for v2.0 milestone)
**Confidence:** HIGH (verified against official Tauri 2 docs, GitHub issues, and wry issue tracker)

---

## Critical Pitfalls

### Pitfall 1: `multiwebview` Feature Flag is Not Production-Ready

**What goes wrong:**
The `multiwebview` unstable Cargo feature — which enables multiple child `Webview` instances inside a single `Window` — ships in Tauri 2.0 stable but remains explicitly marked unstable. Active, unresolved bugs include: webviews rendering stacked vertically instead of at their specified coordinates, child webviews stopping resize tracking after a few window resizes, only the last child rendering on some platforms, `WindowEvent::Focused` never firing when the flag is enabled, and Linux-specific layout failures.

**Why it happens:**
The API design is still under community review. The feature was gated behind a flag precisely because it is unfinished. Developers see "Tauri 2 stable" and assume all features within it are stable.

**How to avoid:**
Use `WebviewWindow` (one window = one webview) as the primary architecture. Each app tab becomes a separate `WebviewWindow` with the OS window chrome hidden or overridden. This approach is fully stable, uses the documented API surface, and is what Tauri maintainers recommend as the production path. Only reach for the `multiwebview` flag if `WebviewWindow` is proven insufficient.

**Warning signs:**
- Child webviews misaligned or invisible after first render
- Window resize breaks layout after 2-3 resizes
- Focus events never fire on the sidebar React component

**Phase to address:**
Architecture decision phase (Phase 1). This determines the entire window/webview model before any other code is written.

---

### Pitfall 2: Session Data is Shared Across All Webviews by Default

**What goes wrong:**
All `WebviewWindow` instances on macOS share the same `WKWebsiteDataStore` (stored at `~/Library/WebKit/`). On Linux, cookies are stored as plain text in a single location. On Windows, it is a shared SQLite database. This means logging into Gmail in one webview can leak session state visible to a webview loading a different site — and more critically, logging into the same site twice (e.g., two Notion accounts) is impossible.

**Why it happens:**
Tauri's WebView abstraction does not expose per-webview data directory isolation by default. Developers assume each webview is isolated because they have separate labels and URLs.

**How to avoid:**
Use the `data_directory` builder option on each `WebviewWindowBuilder` to point each app's webview at a unique directory (e.g., `~/.nexus/profiles/<app-id>/`). Verify this on all three platforms early. Accept that on macOS, `WKWebsiteDataStore` segmentation via `data_directory` is the only available lever — deeper per-profile API access is not exposed by Tauri (issue #11491 was closed as "not planned").

**Warning signs:**
- Logging into app B logs you out of app A (shared cookie jar)
- `document.cookie` returns cookies from a different site's domain (shouldn't happen with same-origin policy, but shared storage paths can cause confusion on restart)
- After restart, all apps are logged in even though only one was authenticated

**Phase to address:**
Phase 1 (core webview architecture). Session isolation must be designed in from the first webview, not retrofitted.

---

### Pitfall 3: External Sites Block Tauri's IPC Layer via CSP

**What goes wrong:**
Tauri 2 injects its IPC bridge into every webview by default. When the webview is loading a third-party site (e.g., Gmail, Notion, Linear), that site's own `Content-Security-Policy` response headers refuse the connection to `ipc.localhost` with: `"Refused to connect to 'http://ipc.localhost/test' because it violates the document's Content Security Policy."` This breaks any Tauri JS API call invoked from within that webview — including `invoke()`, window APIs, and event listeners.

**Why it happens:**
Tauri v2 switched from `window.ipc.postMessage` to a custom protocol (`ipc.localhost`) on Windows and macOS. External sites enumerate allowed connection targets in their CSP; `ipc.localhost` is never on that list. The fallback to `postMessage` was added (issue #8476 was fixed), but the reliability of this fallback across all sites is not guaranteed.

**How to avoid:**
Do not inject Tauri JS APIs into app webviews that load external URLs. The Rust backend (not the webview JS) should own all IPC communication. Use Rust-side event emitters (`app_handle.emit()`) to push data to the sidebar webview rather than calling Tauri APIs from within the app webview. Treat app webviews as untrusted third-party content — they cannot and should not call `invoke()`.

**Warning signs:**
- Console errors about `ipc.localhost` connection refusals in any app webview
- `window.__TAURI__` is undefined or partially broken inside an app tab
- Title-change detection or navigation events not firing from app webviews

**Phase to address:**
Phase 1 (IPC architecture). The decision of which webview owns Tauri IPC must be explicit from the start.

---

### Pitfall 4: `window.open` and `target="_blank"` Popups Are Blocked

**What goes wrong:**
Starting in Tauri 2.3.0, webviews cannot open detached popup windows. This breaks OAuth login flows (Google, Microsoft, GitHub, Apple sign-in), payment confirmation popups, and any site that relies on `window.open()` or `<a target="_blank">` for authentication or sub-flows. The root cause is a change in wry that always registers a `newWindowRequested` listener which blocks window creation by default to unify behavior across platforms. A separate known bug also prevents `on_navigation` from firing for `<form target="_blank">` submissions.

**Why it happens:**
Developers test with simple URLs first. OAuth flows and popup-dependent features only surface when real-world apps (Gmail, GitHub, Linear) are loaded. The regression was introduced mid-2.x series, so Tauri 1 experience does not predict Tauri 2 behavior.

**How to avoid:**
Register an `on_new_window` handler in Rust for every app `WebviewWindowBuilder` that returns `NewWindowResponse::Allow` for known OAuth/popup domains, and routes all other new-window requests to `shell::open()` (the system browser). This must be configured at the Rust level — the JS API equivalent was not yet exposed at the time of research (PR #14289 was pending). Test each target app's auth flow explicitly before declaring it "working."

**Warning signs:**
- OAuth login button clicks produce no visible response (popup silently blocked)
- Login redirect to Google/GitHub hangs at the authentication step
- Developer console shows no navigation error — the popup is simply never created

**Phase to address:**
Phase 1 (webview builder configuration) and Phase 2 (per-app auth smoke tests). The handler must be in place before testing any app that uses third-party auth.

---

### Pitfall 5: Lazy Loading via Destroy/Recreate Does Not Fully Release Memory

**What goes wrong:**
Destroying a `WebviewWindow` does not reliably free its memory on all platforms. A confirmed issue shows that after closing a `WebviewWindow`, the OS process entry persists and allocated heap is not reclaimed. On macOS, WKWebView's process is managed by the OS and may not terminate immediately. On Windows, WebView2 can leave orphaned processes. Audio from destroyed webviews has been observed continuing to play.

**Why it happens:**
The underlying webview engines (WKWebView, WebView2, WebKitGTK) manage their own process lifecycle. Tauri/wry has no direct authority to force-kill them. Developers assume `webview.close()` == memory freed.

**How to avoid:**
Instead of destroy/recreate cycles, use a **hide/show strategy with a webview pool**. Keep the N most recently used webviews alive but hidden (using `webview.hide()` / `webview.show()`). On Windows specifically, call `set_memory_usage_level(Low)` on hidden webviews to let WebView2 aggressively page out memory. Define the pool size conservatively (3-5 concurrent) and benchmark against the 500MB RAM budget with real-world sites. Do not treat `close()` as a memory guarantee.

**Warning signs:**
- `Activity Monitor` / `Task Manager` shows growing memory over time despite "closing" tabs
- Phantom audio from closed tabs
- Process count in OS does not decrease as tabs are closed

**Phase to address:**
Phase 2 (lazy loading / webview lifecycle). Design the pool strategy before implementing tab switching.

---

### Pitfall 6: Linux WebKitGTK Version Fragmentation Breaks Cross-Distro Builds

**What goes wrong:**
Tauri 2 requires `webkit2gtk-4.1` (with `soup3`). Ubuntu 20.04 and Ubuntu 22.04 ship `4.0` (with `soup2`); Ubuntu 24.04 ships `4.1`. You cannot link both. This means a single Linux binary cannot run on all Ubuntu LTS versions. AppImage builds have additional glibc compatibility constraints — the AppImage must be built on the *oldest* target distro (Ubuntu 22.04 minimum for Tauri 2) or it will not run on older systems. Fedora and Arch are generally compatible with `4.1` but the fragmentation makes CI/CD non-trivial.

**Why it happens:**
Developers test on their development machine (often a recent Ubuntu or Fedora) and assume the build is portable. Linux distro versioning is more fragmented than macOS/Windows.

**How to avoid:**
Build Linux artifacts in a Docker container pinned to Ubuntu 22.04 (the oldest supported LTS for Tauri 2). Explicitly test the `.deb` package on Ubuntu 22.04 and the `.AppImage` on Ubuntu 22.04 and Fedora 39+. Document the minimum system requirements in the README. Do not rely on AppImage to "just work" without testing — build failures have been widely reported.

**Warning signs:**
- `cargo tauri build` fails on CI with `libwebkit2gtk-4.1-dev: Package not found`
- AppImage crashes immediately on any distro other than the build machine
- `glibc` version mismatch errors at runtime

**Phase to address:**
Phase 3 (cross-platform distribution). Set up the Linux Docker build environment before attempting Linux distribution.

---

## v2.0 Feature Pitfalls

*The following pitfalls are specific to the v2.0 milestone features: Spaces, Multi-Account, Split View, Notifications, Animations, Preferences, and Code Signing.*

---

### Pitfall 7: LRU Pool is Per-App-ID — Spaces Will Collide on IDs

**What goes wrong:**
The current `AppState.lru_order` is a flat `VecDeque<String>` keyed by `app_id` (e.g., `"gmail"`). When Spaces are added, two different spaces can each contain an app with the same logical ID. For example, Space A has `gmail` (personal) and Space B also has `gmail` (work). The LRU pool only holds `"gmail"` once. Switching to Space B evicts Space A's `gmail` webview and the user loses their Space A session.

**Why it happens:**
The pool was designed for a flat app list. Spaces introduce a second dimension (space context) that the current single-key design cannot represent. `app_id` alone is no longer a unique webview key.

**How to avoid:**
Change the webview key from `app_id` to a compound key: `"{space_id}:{app_id}"`. Update `AppState.webviews_created: HashSet<String>`, `lru_order: VecDeque<String>`, `active_app_id: Option<String>`, and the webview label (currently `format!("app-{}", app_id)`) to use the compound key. Audit every place `app_id` is used as a key in both Rust and the React frontend before adding any Space UI.

**Warning signs:**
- Switching spaces logs out of the other space's session for shared app IDs
- LRU eviction removes the wrong webview when two spaces have apps with the same ID
- The webview label `app-gmail` exists twice in Tauri's registry (Tauri will panic or silently return the first match)

**Phase to address:**
Spaces phase (whichever phase introduces `SpaceConfig`). The key scheme refactor must happen before any Space switching UI is wired up.

---

### Pitfall 8: Multi-Account Requires a New Store ID Scheme — `make_store_id(app_id)` Is No Longer Unique

**What goes wrong:**
The current `make_store_id` function hashes only `app_id` to produce the `data_store_identifier` (macOS) or `data_directory` path (Linux/Windows). For multi-account support, two entries with the same URL but different accounts (e.g., `gmail-personal` and `gmail-work`) both resolve to separate `app_id`s — that part is fine. But if the user creates their multi-account entries with identical IDs in the JSON (which is valid from the config model's perspective), both webviews will receive the same store ID and share the same session, silently defeating isolation.

Additionally, on macOS 14+, `WKWebsiteDataStore(forIdentifier:)` requires a stable UUID. If the `make_store_id` hash input changes (e.g., `app_id` gets renamed by the user), the previous store becomes orphaned at `~/Library/WebKit/WebsiteDataStore/<old-UUID>`, leaking disk space indefinitely. There is no automatic cleanup.

**Why it happens:**
The v1.0 design assumes `app_id` is user-assigned and unique. Multi-account workflows either (a) force users to invent unique IDs manually or (b) auto-generate IDs that are opaque. Neither path was designed for the current config model.

**How to avoid:**
- Make `app_id` globally unique by design — enforce uniqueness at config save time in the UI. On multi-account add, auto-suffix: `gmail-1`, `gmail-2`.
- Change `make_store_id` to hash `(app_id, account_index)` or just `app_id` where `app_id` is guaranteed unique.
- For macOS, store the UUID alongside the app config so renames do not orphan the old data store. Add a migration path or a `~/.nexus/orphaned_stores.json` cleanup list.
- For Linux/Windows, `data_directory` paths are visible and self-documenting; warn users in the preferences UI if they rename an app that has an existing profile directory.

**Warning signs:**
- Two "different" accounts share the same session (both show the same logged-in account)
- After renaming an app in preferences, the session resets on next launch
- `~/Library/WebKit/WebsiteDataStore/` grows unboundedly with orphaned UUIDs

**Phase to address:**
Multi-account phase. Config model must guarantee `app_id` uniqueness before session isolation can be trusted.

---

### Pitfall 9: Split View Requires Simultaneous Visible Webviews — `switch_app_impl` Hides All Others

**What goes wrong:**
The current `switch_app_impl` hides the previous app's webview when showing the new one (line: `if let Some(prev) = prev_app_id { wv.hide() }`). Split view requires two webviews visible simultaneously. If split view is implemented by calling `switch_app_impl` twice (once for each pane), the second call will hide the first pane's webview.

Additionally, `resize_active_webview` and the window resize handler in `lib.rs` only resize `active_app_id` — a single webview. With split view, both visible webviews must be repositioned and resized on window resize.

**Why it happens:**
The single-active-app invariant is baked into `AppState` (only one `active_app_id`). There is no concept of "multiple simultaneously visible apps."

**How to avoid:**
- Add a `split_view: Option<(String, String)>` field to `AppState` that holds the compound key of both panes when split mode is active.
- Introduce a `split_app_impl` function that positions two webviews side-by-side at `(x, y, w/2, h)` and `(x + w/2, y, w/2, h)`.
- Update the window resize handler to iterate over `split_view` panes and resize both.
- Ensure the existing `switch_app_impl` does NOT hide a webview that is currently in the other split pane.
- The `calc_webview_rect` function must gain a `pane: SplitPane` parameter (Left/Right/Full) before split view is attempted.

**Warning signs:**
- Opening split view causes one of the two panes to go blank immediately
- Window resize only updates one pane; the other stays at the wrong size
- Closing split view leaves both webviews visible (neither was hidden)

**Phase to address:**
Split view phase. Requires refactoring `AppState` before any split view UI can be wired up.

---

### Pitfall 10: The Web Notification API in App Webviews Requires Intercepting Native Permission — Tauri Overwrites `window.Notification`

**What goes wrong:**
Tauri 2's notification plugin (`tauri-plugin-notification`) works by **overwriting** `window.Notification` globally in the main webview with a bridge to native OS notifications. However, the app webviews load external third-party sites (Gmail, Linear, etc.) that call the real browser `Notification.requestPermission()` expecting the browser permission dialog. Two problems arise:

1. If Tauri's notification plugin is not scoped to only the main/sidebar webview, it overwrites `window.Notification` in app webviews too, which changes the behavior of `Notification.requestPermission()` in ways the external site does not expect.

2. If the plugin is correctly scoped to the sidebar only, app webviews still need the underlying WKWebView/WebView2 to grant notification permission to the external site's origin. On macOS, WKWebView does not forward `Notification.requestPermission()` to the OS by default — it returns `"denied"` unless the host app implements `WKUIDelegate.webView(_:requestNotificationPermissionFor:decisionHandler:)`.

**Why it happens:**
The Tauri notification plugin was designed for apps where the developer controls all the webview content. When the webview loads untrusted external sites, the plugin-level permission model and the web-standard permission model collide.

**How to avoid:**
- Scope `tauri-plugin-notification` to the sidebar (main) webview only via capabilities — do NOT grant it to app webviews with external URLs.
- For native notifications triggered by app webviews (e.g., Gmail shows "You have a new message"), use the existing `notify_title_changed` IPC pattern extended to handle notification requests: inject an initialization script into each app webview that intercepts `Notification.requestPermission()` and proxies the call to Rust, which then fires the OS notification via Tauri's plugin from the privileged sidebar context.
- On macOS, implement the `with_webview` block to configure `WKUIDelegate` for notification permission decision — or accept that Gmail/Slack cannot show their own push notifications (users get them from the OS/browser instead).

**Warning signs:**
- `Notification.permission` returns `"denied"` for all app webviews regardless of user choice
- Tauri notification works in the sidebar but not triggered by external app events
- Gmail notification badge updates but no OS notification appears

**Phase to address:**
Notifications phase. The capability scoping must be done before enabling the plugin, not after.

---

### Pitfall 11: Animations Break the Sub-100ms Switch Contract on WebKitGTK

**What goes wrong:**
Adding CSS animations to the sidebar (tab switch transitions, fade-in/fade-out) can degrade the perceived switching speed below the 100ms contract, particularly on Linux with WebKitGTK. WebKitGTK's CSS animation performance is documented to be significantly worse than Chromium/Firefox — `transform` and `opacity` animations that run at 60fps in a browser may drop to 30fps or lower in a Tauri app on Linux. On macOS, `WKWebView` rendering is hardware-accelerated and generally fine, but animation of the sidebar during a webview show/hide triggers a layout recalculation that adds ~20-50ms of additional overhead.

**Why it happens:**
Developers test animations on macOS (where they look great) and assume cross-platform parity. WebKitGTK's GPU pipeline for CSS transforms is less optimized than macOS's Core Animation.

**How to avoid:**
- Keep sidebar tab-switch animations to `opacity` and `transform: translateX` with `will-change: transform` — never animate `width`, `height`, or `layout`-triggering properties.
- Gate animations behind a `prefers-reduced-motion` media query AND a user preference toggle.
- On Linux, use shorter animation durations (100ms vs 250ms on macOS) or disable them entirely with a platform detection check (`navigator.platform` or Tauri's `platform()` API).
- Measure: the webview `show()` call must happen BEFORE the animation starts, not after — never delay the content reveal for aesthetics.
- Test the full switch cycle (click icon → webview visible) on an actual Linux machine, not just macOS.

**Warning signs:**
- Sidebar animations jank/stutter on Linux at full load
- App switching feels slower after adding animations even though no webview code changed
- `will-change` warnings in browser DevTools about excessive GPU layer promotion

**Phase to address:**
Polish / animations phase. Measure switching latency with and without animations before shipping. Set a regression threshold.

---

### Pitfall 12: Preferences Panel Writing to `apps.json` Can Clobber In-Flight Config Changes

**What goes wrong:**
The current `save_config` command serializes and writes the entire `NexusConfig` to `~/.nexus/apps.json` atomically. The preferences panel will introduce visual settings (border-radius, colors, gap sizes, themes) stored in the same file. If the user is dragging to reorder apps at the same time the preferences panel auto-saves a color change, the config write from the preferences save uses the `NexusConfig` it loaded before the reorder happened — dropping the reorder.

This is a last-write-wins race condition. The current code does not have this problem because only one UI path writes the config, but a preferences panel adds a second concurrent writer.

**Why it happens:**
Single-threaded React state and immediate JSON serialization mask this in development, where operations feel instantaneous. In production with slow disks or large configs, the race is real.

**How to avoid:**
- Adopt a single-writer model: all config mutations go through a Rust command that takes a delta/patch, not a full config snapshot. The Rust command holds the mutex and applies the patch in-order.
- Or: debounce preferences saves with a 500ms delay and merge pending changes before writing.
- The `AppState.config` must be the canonical source of truth — the frontend should never hold a stale copy it writes back wholesale.

**Warning signs:**
- Drag-to-reorder saves get lost after tweaking a preference setting
- Config file shows previous ordering even after user saved a new order
- Race becomes visible when quickly saving multiple preference changes

**Phase to address:**
Preferences phase. Introduce the delta-mutation pattern before adding a second UI path that writes config.

---

### Pitfall 13: macOS Code Signing — WKWebView Requires JIT Entitlements, Hardened Runtime Blocks It

**What goes wrong:**
When enabling Hardened Runtime (required for notarization), macOS blocks JIT compilation by default. WKWebView requires JIT to render modern web content — without it, the app either crashes on launch or webviews fail to load any content. The fix is adding `com.apple.security.cs.allow-jit` to the entitlements file, but if `Entitlements.plist` is not included in the Tauri build configuration, the app passes initial signing but crashes for users who download it.

A secondary issue: the macOS data store identifier API requires the app to be signed with a valid identity before `WKWebsiteDataStore(forIdentifier:)` will work. Unsigned builds (or builds with ad-hoc signing) may silently fall back to the default data store, making multi-account session isolation appear to work in development but fail in production.

**Why it happens:**
The notarization flow is documented, but the specific entitlements required for webview apps are not prominent in Tauri's documentation. Developers assume "sign and notarize" is a single step, not a multi-step configuration requiring platform-specific entitlements.

**How to avoid:**
Create `src-tauri/entitlements.plist` with at minimum:
```xml
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.app-sandbox</key><true/>
<key>com.apple.security.network.client</key><true/>
```
Reference this file in `tauri.conf.json` under `bundle.macOS.entitlements`. Test the *signed and notarized* build on a fresh Mac before releasing — notarization issues are invisible until user download.

**Warning signs:**
- App passes `codesign --verify` but crashes immediately after notarization
- `Console.app` shows `AMFI: code signing error` or `kill: executable not allowed to perform JIT`
- Multi-account sessions work in dev (`cargo tauri dev`) but reset after installing the distributed `.dmg`

**Phase to address:**
Code signing phase. Entitlements must be configured before the first notarization attempt.

---

### Pitfall 14: Windows Code Signing — OV Certificates No Longer Ship as Exportable Files; SmartScreen Reputation Takes Time

**What goes wrong:**
Since June 2023, Certificate Authorities stopped issuing OV (Organization Validation) code signing certificates as exportable `.p12` / `.pfx` files. New certificates must be stored on HSMs (Hardware Security Modules). For CI/CD, the practical option is Azure Key Vault. This means the simple `TAURI_SIGNING_PRIVATE_KEY` environment variable approach documented in many tutorials no longer works for new certificate purchases.

Additionally, even with a valid EV certificate (the historically "instant trust" option), Microsoft changed SmartScreen behavior in March 2024: EV certificates no longer immediately suppress SmartScreen warnings. New apps still accumulate reputation over time.

**Why it happens:**
Tauri docs reference the old exportable certificate workflow which no longer applies to new purchases. EV certificate vendors still market "instant SmartScreen bypass" but this is no longer accurate.

**How to avoid:**
- Use Azure Key Vault as the HSM for CI/CD signing. Configure the `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_KEY_VAULT_URI`, and `AZURE_CERTIFICATE_NAME` environment variables in GitHub Actions.
- Use `tauri.conf.json`'s `bundle.windows.certificateThumbprint` + custom sign command pointing to `AzureSignTool.exe`.
- Accept that SmartScreen warnings will appear for early users regardless of certificate type. Document the "Run Anyway" click for early adopters.
- Do NOT buy an OV certificate expecting instant SmartScreen bypass — it does not work that way anymore.

**Warning signs:**
- "The specified file is not a valid pfx file" error during CI signing with a post-June-2023 certificate
- SmartScreen warning appears despite having a valid EV certificate
- `signtool.exe` errors referencing HSM token prompts in CI

**Phase to address:**
Code signing phase. Research the certificate procurement path before starting the signing implementation.

---

### Pitfall 15: Spaces — Per-Space LRU Pool vs. Global Pool Tradeoff Has No Obvious Winner

**What goes wrong:**
With Spaces, there are two valid pool designs:

**Global pool (current model extended):** The single LRU pool of size 8 spans all spaces. Switching spaces evicts webviews from the previous space if the total active count exceeds 8. The user gets back to Space A, and their apps are gone (cold switch).

**Per-space pool:** Each space has its own LRU pool (e.g., 4 webviews each for 2 spaces = 8 total). Switching spaces always does a cold switch to any space not currently in memory, but within a space, switching is instant.

Neither is clearly correct and the wrong choice requires a full pool architecture rewrite.

**Why it happens:**
The pool size of 8 was chosen against a flat app list. Spaces multiply the number of potentially "active" webviews.

**How to avoid:**
Make an explicit design decision before coding the pool. Recommended approach: **per-space pool with configurable per-space size** (default: 4), using a global hard cap of `max_total_webviews = num_spaces * per_space_pool`. Add `space_pool_size: usize` to `AppState`. This gives users the "within-space instant switching" experience while preventing unbounded memory growth. Document the design decision in a code comment on `AppState`.

**Warning signs:**
- Switching to another space and back evicts the previous space's webviews when using global pool
- Memory grows unboundedly when many spaces are open with a per-space pool without a global cap

**Phase to address:**
Spaces phase (pool architecture decision). Must be resolved in the design doc before implementing `SpaceConfig`.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `multiwebview` unstable flag instead of `WebviewWindow` per tab | Single window, simpler layout math | Layout bugs, resize failures, platform-specific rendering breaks, stuck on an unstable API surface | Never for production |
| Share a single WebView data directory for all app tabs | Less config code | Session contamination across apps, impossible to have two accounts on same site | Never |
| Skip `on_new_window` handler, rely on default popup behavior | Less Rust code | OAuth flows silently fail on all apps using third-party auth | Never |
| Destroy/recreate webviews for lazy loading | Conceptually simple | Memory not reliably freed, process leak, audio ghost | Never — use hide/show pool instead |
| Hardcode Linux build on developer's distro | Faster CI setup | Binary incompatible with Ubuntu LTS users | Only for personal-use builds, never for distribution |
| Call Tauri `invoke()` from inside app webviews | Convenient JS integration | Breaks silently on any site with a strict CSP | Never — use Rust-side IPC only |
| Use flat `app_id` as webview key when spaces exist | No refactor needed | Key collision across spaces, LRU corrupts wrong space's session | Never once Spaces are added |
| Write entire `NexusConfig` to disk from preferences panel | Simple save logic | Last-write-wins race with other config mutations | Only if config writes are serialized through a single Rust mutex |
| Skip `com.apple.security.cs.allow-jit` entitlement | Faster signing setup | App crashes on all notarized Mac installs | Never |
| Use old exportable `.p12` certificate workflow for Windows signing | Familiar documentation | Certificate issuers no longer support exportable OV certs post-June-2023 | Never for new certs |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Per-app session storage | Assuming webview label isolation = data isolation | Explicitly pass unique `data_directory` path per app in `WebviewWindowBuilder` |
| OAuth popup flows | Assuming `window.open()` works by default | Register Rust-level `on_new_window` handler returning `Allow` for auth domains |
| Title change detection for badge dots | Polling `document.title` from React sidebar | Inject a `MutationObserver` on `<title>` via `webview.evaluate_script()` and emit a Tauri event to the sidebar; no native title-change event exists in wry |
| External links (target=_blank) | Letting Tauri open them as new WebviewWindows | Intercept with `on_navigation` handler; if URL is outside app domain, call `shell::open()` for system browser |
| `~/.nexus/apps.json` config file | Using Tauri path variables at JS layer | Use `$HOME` path resolution via Rust `tauri::api::path::home_dir()` — app data directories (`$APPDATA`) may not be created automatically on Linux (issue #10314) |
| Windows WebView2 memory | No memory management when tabs hidden | Call `set_memory_usage_level(Low)` on hidden WebviewWindows via `WebViewExtWindows` trait |
| Multi-account same-site sessions | Assuming different `app_id` = different session | Verify with explicit `data_directory` per app AND test by logging into different accounts simultaneously |
| Spaces + LRU eviction | Global pool evicts other-space webviews | Use per-space pool with global cap; namespace all webview keys as `{space_id}:{app_id}` |
| macOS notarization + webview | Assuming default Hardened Runtime entitlements cover webview needs | Always include JIT and unsigned executable memory entitlements explicitly |
| Windows SmartScreen + code signing | Expecting EV cert to suppress warning immediately | Budget for reputation accumulation time; document "Run Anyway" for early users |
| Notifications from app webviews | Granting notification capability to app webviews | Scope capability to sidebar only; proxy notification requests from app webviews through initialization script → Rust |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Creating a new WebviewWindow on every tab switch | Startup delay on switch (200ms+), growing memory | Keep a pool of pre-created, hidden webviews; only create on first access | Any webview pool > 2 tabs |
| Eager-loading all configured apps on startup | Startup time > 1s, high initial RAM | Load webviews lazily — only create on first click | 5+ apps in config |
| Sending large JSON payloads over Tauri IPC | IPC uses message passing; serialization overhead on large payloads | Keep IPC messages small; pass identifiers not data blobs | Payloads > 1MB |
| Tauri event listeners never unlistened | Memory grows on every tab switch if listeners attached per-webview | Always `await unlisten()` in useEffect cleanup; use `window.addEventListener('unload', ...)` for webview-level cleanup | After 10+ navigation events |
| Polling `webview.url()` for navigation tracking | High CPU from tight polling loop | Use `on_navigation` handler in Rust (Tauri 2 supports it), emit event to sidebar | Immediate — polling is always wrong |
| Animating `width`/`height` in sidebar on switch | Layout thrash causes switch latency to exceed 100ms | Use `transform: translateX` and `opacity` only; avoid `will-change` on more than 3 elements | Immediately visible on Linux/WebKitGTK |
| Showing animation before `webview.show()` returns | User sees blank pane then content | Call `webview.show()` synchronously first, then start animation | Any animated transition |
| Global webview pool with many spaces | Cross-space eviction on every space switch | Per-space pools with global cap; benchmark with 3 spaces × 5 apps each | 2+ spaces with different app sets |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Granting `shell:allow-execute` capability broadly | App webview JS could invoke arbitrary shell commands if a XSS occurs in a loaded site | Scope capabilities to the sidebar webview only, not to app webviews; use distinct capability files per webview label |
| Exposing `fs:allow-write` to app webviews | A compromised site could write to `~/.nexus/apps.json` or anywhere on disk | Filesystem write permissions go to sidebar/config webview only; app webviews get no capabilities |
| Using `dangerouslyDisableAssetCspModification` | Disables automatic CSP nonce injection | Never use; if a site's CSP conflicts, handle at the `on_navigation` / response intercept layer |
| Reading HTTP-only cookies via `document.cookie` | HTTP-only cookies are not readable via JS — silently returns empty string, session appears lost | Do not build session-persistence logic around JS cookie reading; persistent sessions work automatically via the webview's native storage when `data_directory` is set correctly |
| Forwarding all `on_new_window` requests with `Allow` | Malicious sites could open popups to phishing URLs | Filter `on_new_window` by domain: allow known OAuth providers, route everything else to `shell::open()` |
| Granting notification capability to app webviews | App webview XSS can trigger arbitrary OS notifications | Scope notification capability to sidebar only; proxy notification requests through Rust |
| Storing app UUIDs (data store identifiers) in a world-readable file | User can enumerate all accounts/sessions | Store UUID map in `~/.nexus/` which is user-home-dir-protected; do not put it in `/tmp` or app bundle |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading indicator while webview first loads | User clicks app icon, sees blank white screen for 1-3s, assumes app is broken | Show a skeleton/spinner in the sidebar's content area until the webview fires a `DOMContentLoaded`-equivalent signal |
| Tab switching re-initializes webview URL | User loses in-progress form or scroll position on every switch | Use hide/show, never reload on switch; only reload on explicit Cmd+R |
| Window resize breaks hidden webviews' layout | After resize, revealing a previously hidden tab shows broken layout | Call `webview.set_size()` on all hidden webviews when the parent window resizes, not just the active one |
| External link opens in a new bare Tauri window | User sees a blank titled window with no browser chrome, no navigation | Intercept `on_new_window` / `on_navigation` for out-of-domain URLs and call `shell::open()` |
| `Cmd+1..9` shortcuts conflict with app content | Sites like Figma or Linear use the same shortcuts internally | Register shortcuts on the window level with `app.global_shortcut_manager()` only when the sidebar or title bar has focus, not when an app webview has focus |
| Space switch shows blank screen for 500ms | User thinks the space switch failed | Pre-load at least the last-active app in each space in the pool so switching feels instant |
| Multi-account apps listed without visual distinction | User cannot tell which Gmail entry is personal vs work | Show an account badge/color on multi-account entries in the sidebar |
| Split view resize handle has no minimum pane size | User drags handle to 0px; one webview disappears | Enforce minimum pane width (e.g., 300px) in the split view resize handler |
| Preferences panel changes apply immediately without undo | User accidentally sets high-contrast colors; cannot revert | Use a "preview" state with a "Reset" button; only persist on explicit "Save" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Session persistence:** Works on first launch but verify after app restart — `data_directory` must be set *and* the path must be stable across launches. Verify all three platforms.
- [ ] **OAuth login:** Test on every app that uses third-party auth (Google, GitHub, etc.) — `on_new_window` handler must be registered or sign-in silently fails.
- [ ] **External links:** Clicking an in-app link that goes out-of-domain must open in the system browser, not a bare Tauri window. Test with `<a target="_blank">`, `window.open()`, and form submissions.
- [ ] **Title change badge:** Verify `MutationObserver` on `<title>` fires correctly — some SPAs update `document.title` without a DOM `<title>` element change (they use `history.pushState`). Test with Gmail, Linear, and Notion.
- [ ] **Linux build:** Produce and install the `.deb` and `.AppImage` on Ubuntu 22.04 *and* Fedora — do not assume the dev machine distro represents real users.
- [ ] **Memory after tab close:** After hiding 5+ tabs and switching between them for 10 minutes, verify RAM is below 500MB — the hide/show pool must have a max size and enforce eviction.
- [ ] **Keyboard shortcuts in app focus:** Press `Cmd+1` while a Figma or Linear webview has focus — verify the shortcut routes to Nexus tab-switch and does not pass through to the site.
- [ ] **`~/.nexus/apps.json` created on first run:** On a fresh install with no pre-existing config, the file and parent directory must be created automatically. Test on Linux where app dirs are not auto-created.
- [ ] **Multi-account isolation:** Log into gmail-personal and gmail-work simultaneously. Open both in the same space. Confirm each shows a different inbox. Restart the app. Confirm sessions are preserved independently.
- [ ] **Space switch:** Switch away from Space A, switch back. Confirm the previously active app in Space A is still visible at its last URL (not reloaded). Test with 2 spaces × 4 apps each.
- [ ] **Split view resize:** Drag the split divider. Confirm both panes resize proportionally. Minimize/restore window. Confirm both panes return to correct dimensions.
- [ ] **Notifications in app webviews:** On Gmail, trigger a notification (send yourself an email). Confirm an OS notification appears. Confirm `Notification.permission` is not `"denied"` in the webview console.
- [ ] **Animation performance:** On a Linux machine (not macOS), run the full sidebar interaction. Confirm animations do not drop below 30fps and do not extend switch latency beyond 100ms.
- [ ] **macOS signed build:** Install the notarized `.dmg` on a fresh Mac. Launch — no "damaged app" or "unverified developer" dialog should appear. Confirm webviews load content (JIT entitlement check).
- [ ] **Windows signed build:** Install on a fresh Windows 10 machine. SmartScreen warning may appear (acceptable). Verify app loads, webviews work, sessions persist across restarts.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Built on `multiwebview` flag, now hitting layout bugs | HIGH | Rewrite webview management layer to use `WebviewWindow` per tab; sidebar becomes its own `WebviewWindow`; significant architectural change |
| Session contamination discovered late | MEDIUM | Add `data_directory` per-app to all existing `WebviewWindowBuilder` calls; existing users lose saved sessions (one-time logout event) |
| OAuth popups broken on deployed app | LOW | Ship a patch release adding the Rust `on_new_window` handler; no architectural change needed |
| Memory leak in webview pool | MEDIUM | Replace destroy-on-evict with hide + `set_memory_usage_level(Low)`; requires reimplementing pool eviction logic |
| Linux AppImage broken on Ubuntu 22.04 | MEDIUM | Rebuild all Linux artifacts in a Ubuntu 22.04 Docker container; update CI pipeline |
| Flat `app_id` key collides across Spaces | HIGH | Migrate all webview keys to `{space_id}:{app_id}`; requires updating Rust state model, all command handlers, and React frontend together |
| Multi-account orphaned data stores on macOS | LOW | Add a one-time cleanup tool that calls `WKWebsiteDataStore.allDataStoreIdentifiers` and removes any UUID not in `apps.json`; ship as a maintenance command |
| Preferences race condition clobbered user's app order | LOW | Revert from last-write-wins to delta-patch model; add a "reload from disk" UI affordance for the edge case |
| Notarized build crashes due to missing JIT entitlement | HIGH | Add entitlements file, re-sign, re-notarize, and re-distribute; users must re-download; cannot be patched in-place |
| Windows signing via old `.p12` workflow broken by CA | MEDIUM | Set up Azure Key Vault + AzureSignTool; update CI secrets; no user-visible change once fixed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `multiwebview` instability | Phase 1: Architecture | Build a spike with `WebviewWindow`-per-tab approach; never enable `multiwebview` flag |
| Session isolation | Phase 1: Core webview setup | Manually verify cookie state does not bleed between two webviews loading the same origin |
| IPC blocked by external CSP | Phase 1: IPC design | Load Gmail/Linear in dev mode; confirm no `ipc.localhost` console errors |
| OAuth popup blocking | Phase 1+2: Webview builder & auth smoke tests | Trigger Google OAuth flow in at least two configured apps |
| Lazy-load memory leak | Phase 2: Tab lifecycle | Profile RAM with 10 tabs after hide/show cycles for 30 minutes |
| Linux build fragmentation | Phase 3: Distribution | CI matrix must build on Ubuntu 22.04 Docker; test artifact on fresh 22.04 VM |
| Event listener leak | Phase 2 onwards | React component for sidebar must have cleanup in every `useEffect` that calls `listen()` |
| External link handling | Phase 2: Navigation interception | Systematic test: click 10 out-of-domain links across 3 apps; all must open system browser |
| LRU key collision across Spaces | Spaces phase (first) | Verify two spaces each with `gmail` app can run separate sessions simultaneously |
| Multi-account store ID collision | Multi-account phase | Verify `app_id` uniqueness enforcement at config save time; verify sessions do not bleed |
| `switch_app_impl` hides split pane | Split view phase | Verify switching to one split pane does not hide the other |
| Window resize breaks split view | Split view phase | Drag window to different sizes; confirm both panes reflow correctly |
| Notification capability scope | Notifications phase | Verify notification plugin is NOT granted to any app webview; test app-webview notification interception |
| Animation latency regression | Polish phase | Benchmark switch latency on Linux before and after animations; assert < 100ms |
| Preferences race condition | Preferences phase | Simultaneously drag-reorder and save a preference; verify neither change is lost |
| macOS JIT entitlement missing | Code signing phase | Launch notarized `.app` on fresh Mac; no AMFI crash |
| Windows HSM certificate setup | Code signing phase | Complete a CI signing run using Azure Key Vault before shipping |

---

## Sources

- [Tauri multiwebview resizing bug #10131](https://github.com/tauri-apps/tauri/issues/10131)
- [Tauri multiwebview positioning bug #10420](https://github.com/tauri-apps/tauri/issues/10420)
- [Tauri multiwebview only last child renders #11376](https://github.com/tauri-apps/tauri/issues/11376)
- [Tauri multiwebview Linux layout error #13071](https://github.com/tauri-apps/tauri/issues/13071)
- [Tauri unstable flag breaks WindowEvent::Focused #12568](https://github.com/tauri-apps/tauri/issues/12568)
- [Popup window creation blocked in webviews #14263](https://github.com/tauri-apps/tauri/issues/14263)
- [CSP issues with external window URLs #8476](https://github.com/tauri-apps/tauri/issues/8476)
- [Enhanced WebView isolation for multi-user login #11491](https://github.com/tauri-apps/tauri/issues/11491)
- [Where are cookies and localStorage stored #8635](https://github.com/tauri-apps/tauri/issues/8635)
- [WebviewWindow memory not released on close #5397](https://github.com/tauri-apps/tauri/issues/5397)
- [Memory leak when emitting events #12724](https://github.com/tauri-apps/tauri/issues/12724)
- [Event listener unlisten race condition fix PR #13306](https://github.com/tauri-apps/tauri/pull/13306)
- [libwebkit2gtk-4.0 not available in Ubuntu 24 #9662](https://github.com/tauri-apps/tauri/issues/9662)
- [Tauri v2 constrained compatibility on Linux #9039](https://github.com/tauri-apps/tauri/issues/9039)
- [APPDATA app directory not created on Linux #10314](https://github.com/tauri-apps/tauri/issues/10314)
- [on_navigation not triggered for target=_blank forms #14090](https://github.com/tauri-apps/tauri/issues/14090)
- [Anchor tag not opening in default browser #4756](https://github.com/tauri-apps/tauri/issues/4756)
- [wry title change detection request #804](https://github.com/tauri-apps/wry/issues/518)
- [Tauri CSP documentation](https://v2.tauri.app/security/csp/)
- [Tauri Webview Versions reference](https://v2.tauri.app/reference/webview-versions/)
- [wry 0.35.0 release notes — set_memory_usage_level API](https://v2.tauri.app/release/wry/v0.35.0/)
- [data_store_identifier crash fix #12843](https://github.com/tauri-apps/tauri/issues/12843)
- [auto_resize conflicts with fixed position #9611](https://github.com/tauri-apps/tauri/issues/9611)
- [v2 multiple webviews white on load #10011](https://github.com/tauri-apps/tauri/issues/10011)
- [WebKit Profiles API (macOS 14 / iOS 17 requirement)](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/)
- [Tauri notification plugin broken #2341](https://github.com/tauri-apps/plugins-workspace/issues/2341)
- [Tauri macOS code signing documentation](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri Windows code signing documentation](https://v2.tauri.app/distribute/sign/windows/)
- [Windows EV certificate custom signing bug #11754](https://github.com/tauri-apps/tauri/issues/11754)
- [Slow CSS animation on Linux wry #617](https://github.com/tauri-apps/wry/issues/617)
- [CSS performance bad on macOS #6577](https://github.com/tauri-apps/tauri/issues/6577)

---
*Pitfalls research for: Tauri 2 multi-webview desktop web-app browser (Nexus v2.0 — Spaces, Multi-Account, Split View, Notifications, Polish, Preferences, Code Signing)*
*Researched: 2026-03-20*

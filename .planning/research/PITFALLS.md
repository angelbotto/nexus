# Pitfalls Research

**Domain:** Tauri 2 multi-webview desktop app browser (web-app launcher with persistent sessions)
**Researched:** 2026-03-18
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

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `multiwebview` unstable flag instead of `WebviewWindow` per tab | Single window, simpler layout math | Layout bugs, resize failures, platform-specific rendering breaks, stuck on an unstable API surface | Never for production |
| Share a single WebView data directory for all app tabs | Less config code | Session contamination across apps, impossible to have two accounts on same site | Never |
| Skip `on_new_window` handler, rely on default popup behavior | Less Rust code | OAuth flows silently fail on all apps using third-party auth | Never |
| Destroy/recreate webviews for lazy loading | Conceptually simple | Memory not reliably freed, process leak, audio ghost | Never — use hide/show pool instead |
| Hardcode Linux build on developer's distro | Faster CI setup | Binary incompatible with Ubuntu LTS users | Only for personal-use builds, never for distribution |
| Call Tauri `invoke()` from inside app webviews | Convenient JS integration | Breaks silently on any site with a strict CSP | Never — use Rust-side IPC only |

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

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Creating a new WebviewWindow on every tab switch | Startup delay on switch (200ms+), growing memory | Keep a pool of pre-created, hidden webviews; only create on first access | Any webview pool > 2 tabs |
| Eager-loading all configured apps on startup | Startup time > 1s, high initial RAM | Load webviews lazily — only create on first click | 5+ apps in config |
| Sending large JSON payloads over Tauri IPC | IPC uses message passing; serialization overhead on large payloads | Keep IPC messages small; pass identifiers not data blobs | Payloads > 1MB |
| Tauri event listeners never unlistened | Memory grows on every tab switch if listeners attached per-webview | Always `await unlisten()` in useEffect cleanup; use `window.addEventListener('unload', ...)` for webview-level cleanup | After 10+ navigation events |
| Polling `webview.url()` for navigation tracking | High CPU from tight polling loop | Use `on_navigation` handler in Rust (Tauri 2 supports it), emit event to sidebar | Immediate — polling is always wrong |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Granting `shell:allow-execute` capability broadly | App webview JS could invoke arbitrary shell commands if a XSS occurs in a loaded site | Scope capabilities to the sidebar webview only, not to app webviews; use distinct capability files per webview label |
| Exposing `fs:allow-write` to app webviews | A compromised site could write to `~/.nexus/apps.json` or anywhere on disk | Filesystem write permissions go to sidebar/config webview only; app webviews get no capabilities |
| Using `dangerouslyDisableAssetCspModification` | Disables automatic CSP nonce injection | Never use; if a site's CSP conflicts, handle at the `on_navigation` / response intercept layer |
| Reading HTTP-only cookies via `document.cookie` | HTTP-only cookies are not readable via JS — silently returns empty string, session appears lost | Do not build session-persistence logic around JS cookie reading; persistent sessions work automatically via the webview's native storage when `data_directory` is set correctly |
| Forwarding all `on_new_window` requests with `Allow` | Malicious sites could open popups to phishing URLs | Filter `on_new_window` by domain: allow known OAuth providers, route everything else to `shell::open()` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading indicator while webview first loads | User clicks app icon, sees blank white screen for 1-3s, assumes app is broken | Show a skeleton/spinner in the sidebar's content area until the webview fires a `DOMContentLoaded`-equivalent signal |
| Tab switching re-initializes webview URL | User loses in-progress form or scroll position on every switch | Use hide/show, never reload on switch; only reload on explicit Cmd+R |
| Window resize breaks hidden webviews' layout | After resize, revealing a previously hidden tab shows broken layout | Call `webview.set_size()` on all hidden webviews when the parent window resizes, not just the active one |
| External link opens in a new bare Tauri window | User sees a blank titled window with no browser chrome, no navigation | Intercept `on_new_window` / `on_navigation` for out-of-domain URLs and call `shell::open()` |
| `Cmd+1..9` shortcuts conflict with app content | Sites like Figma or Linear use the same shortcuts internally | Register shortcuts on the window level with `app.global_shortcut_manager()` only when the sidebar or title bar has focus, not when an app webview has focus |

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

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Built on `multiwebview` flag, now hitting layout bugs | HIGH | Rewrite webview management layer to use `WebviewWindow` per tab; sidebar becomes its own `WebviewWindow`; significant architectural change |
| Session contamination discovered late | MEDIUM | Add `data_directory` per-app to all existing `WebviewWindowBuilder` calls; existing users lose saved sessions (one-time logout event) |
| OAuth popups broken on deployed app | LOW | Ship a patch release adding the Rust `on_new_window` handler; no architectural change needed |
| Memory leak in webview pool | MEDIUM | Replace destroy-on-evict with hide + `set_memory_usage_level(Low)`; requires reimplementing pool eviction logic |
| Linux AppImage broken on Ubuntu 22.04 | MEDIUM | Rebuild all Linux artifacts in a Ubuntu 22.04 Docker container; update CI pipeline |

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

---
*Pitfalls research for: Tauri 2 multi-webview desktop web-app browser (Nexus)*
*Researched: 2026-03-18*

# Feature Research

**Domain:** Desktop web-app browser (unified launcher for web apps)
**Researched:** 2026-03-18 (v1.0) / 2026-03-20 (v2.0 update)
**Confidence:** HIGH (based on direct competitor analysis: Station, Wavebox, Ferdium, Franz, Shift, Rambox, WebCatalog, Arc; Tauri 2 official docs and GitHub issues verified)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent sessions across restarts | Core value prop — being "logged in" is why you use this over a browser | MEDIUM | Requires cookie/session storage per-webview. Tauri webview uses platform data dir by default; must be configured to persist to a known path. |
| Sidebar navigation with app icons | Every competitor (Station, Ferdium, Rambox, Wavebox, Shift) has this as the primary UI paradigm | LOW | Fixed left/right panel. Icon + label. Active indicator. |
| App groups / categories | Users have 5-20 apps; grouping is the only way to manage the list | LOW | Collapsible sections (Work, Social, News). Station, Wavebox, Ferdium all have this. |
| Keyboard shortcuts to switch apps | Power users won't tolerate mouse-only navigation | LOW | Cmd+1..9 is the universal expectation. All competitors implement this. |
| Reload active app | Basic browser behavior users muscle-memory from every browser | LOW | Cmd+R. Non-negotiable. |
| Lazy loading / sleep inactive apps | Without this, RAM becomes unusable fast — WhatsApp WebView2 alone can hit 1-2GB idle | HIGH | Wavebox defaults to 15-min sleep. Station calls it "autosleep". Ferdium calls it "hibernation". All competitors implement this — it's the defining performance feature. |
| External links open in system browser | Users don't want Nexus to become a general browser; they want their real browser for external navigation | LOW | Intercept navigation events in webview, open with `open` / `xdg-open` / `start`. |
| Add / remove apps without reinstalling | Users need to configure their workspace; a hardcoded list is a dealbreaker | LOW | JSON config at `~/.nexus/apps.json` is the right call for power users. |
| Dark mode | Standard expectation on all desktop apps in 2025 | LOW | CSS `prefers-color-scheme` + Tauri system theme detection. |
| Unread / activity badge on app icon | Users need to see "something happened" without switching to the app | MEDIUM | Parse page title for count (e.g. "(3) Slack"), or detect title change. Cannot rely on native OS badge API cross-platform. |
| Drag-and-drop reorder in sidebar | Users curate their own app order; no reordering = frustration | MEDIUM | Requires drag state, visual feedback (shadow/lift), drop target highlight, and JSON write-back. |
| Cross-platform (macOS, Linux, Windows) | Tauri's entire value prop; excluding a platform is a competitive disadvantage | HIGH | Platform-specific webview quirks: WebKit on macOS, WebKitGTK on Linux, WebView2 on Windows. Each has different behavior and memory profiles. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Command palette (Cmd+K) | Fastest way to switch apps, especially when you have 10+ | MEDIUM | Fuzzy search across app names. Can also expose quick actions (Reload, Add URL, Toggle sidebar). All competitors that have this are rated higher by power users. Rambox calls it "Quick Search", Station calls it "Quick Switch". |
| Startup < 1 second | Competing products (Electron-based: Ferdium, Station, Franz) have 2-5s cold start; Tauri can be <1s | HIGH | Requires lazy webview init — don't create webviews on startup, create on first visit. Tauri binary is 5-10x smaller than Electron. |
| RAM < 500MB for 10 active apps | Electron apps routinely exceed 1GB for 5-10 apps. WhatsApp's WebView2 alone = 1-2GB. Tauri native webviews share OS-level rendering engine | HIGH | The "low RAM" claim is meaningless without lazy loading + suspension. Must instrument and validate. This is Nexus's primary competitive claim. |
| File-based config (`~/.nexus/apps.json`) | Scriptable, version-controllable, diffable. Power users can share configs, generate them programmatically | LOW | No competitors do pure JSON config. All use GUIs. This is a real differentiator for developer-target audience. |
| Instant app switching (<100ms perceived) | Competitors have noticeable lag when switching to a sleeping/unloaded app | HIGH | Requires careful webview lifecycle: keep recent N webviews alive, restore others on demand. The "recently used" LRU cache strategy is key. |
| Collapsible sidebar (Cmd+B) | Arc pioneered this — full-screen webview with hidden chrome is significantly better for focused work | LOW | Simple CSS transform + Tauri window resize or panel hide. Payoff is high, cost is low. |
| Silent activity badge (no native notifications) | Notification fatigue is real. A dot or count badge on the sidebar icon is lower-friction than OS popups | MEDIUM | Must parse page title reliably. Some apps encode count in title (Gmail: "(5) Inbox"), some don't. Fallback: mutation observer on `<title>`. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Cloud sync for spaces/preferences | Users want settings across machines | Requires backend, auth, conflict resolution — directly violates the "zero backend" architecture decision | JSON config is a file — users can sync it themselves with Dropbox/iCloud/git (already in PROJECT.md as explicit out-of-scope) |
| Tabs within a space | Users want browser-style tabs per app | Exponential UI complexity; turns Nexus into a full browser; LRU pool math breaks; competes with the OS browser | Spaces handle the context-switching use case; tabs are what the system browser is for |
| App marketplace / recipes catalog | Franz/Ferdium model: curated list of "recipes" for 100+ apps | Massively increases maintenance surface. Recipes break when apps update their HTML. Becomes a full-time job. Franz/Ferdi both struggled with recipe maintenance as a core pain point. | JSON config with a simple `url` field. Users add any URL. No recipes needed. |
| Browser extension support | Users want 1Password, Bitwarden, Grammarly in webviews | Platform webviews (WebKit, WebView2) do NOT support browser extensions the same way Chromium does. Station/Wavebox do this by embedding full Chromium, which destroys the RAM advantage. | Not feasible without abandoning Tauri's native-webview model. Document explicitly in README. |
| OAuth / account system (cloud sync) | Users want their config to sync across machines | Cloud sync = server infrastructure, auth, encryption, privacy liability. Destroys the "zero backend" architecture. | JSON config is a file — users can sync it themselves with Dropbox/iCloud/git |
| In-app browser for external links | Users sometimes want to stay in Nexus context | Defeats the entire design principle. Nexus is for web apps, not general browsing. Creates a half-baked browser experience. | Always system browser for external navigation. No exceptions. |
| Full screen / per-app window | Some users want each app maximized separately | Defeats the unified launcher value proposition; turns Nexus into just a process launcher | Split view handles the "see more" use case |

---

## Feature Dependencies

```
[Persistent Sessions]
    └──requires──> [Per-app data directory / partition]
                       └──requires──> [Stable app identity (URL or app ID)]

[Lazy Loading / Sleep]
    └──requires──> [Webview lifecycle management (create/destroy/restore)]
                       └──requires──> [LRU cache for "recently used" webviews]
                       └──requires──> [Stable app identity]

[Activity Badge]
    └──requires──> [Webview JS access (title mutation observer or IPC)]
    └──enhances──> [Sidebar Navigation]

[Drag & Drop Reorder]
    └──requires──> [Sidebar Navigation]
    └──requires──> [JSON config write-back]

[Command Palette]
    └──enhances──> [Sidebar Navigation] (alternative navigation path)
    └──requires──> [App list / state available to React layer]

[File-based Config (apps.json)]
    └──is required by──> [Add/Remove Apps]
    └──is required by──> [Drag & Drop Reorder]
    └──is required by──> [App Groups]

[App Groups]
    └──requires──> [File-based Config] (groups defined in JSON)
    └──requires──> [Sidebar Navigation] (groups rendered in sidebar)

[Startup < 1s]
    └──requires──> [Lazy Loading] (don't init webviews until first visit)
    └──conflicts──> [Pre-loading all webviews on startup]

[RAM < 500MB]
    └──requires──> [Lazy Loading / Sleep]
    └──conflicts──> [Pre-loading all webviews on startup]
    └──conflicts──> [Extension support] (requires Chromium = kills RAM advantage)

--- v2.0 additions ---

[Spaces]
    └──requires──> [JSON config extension (spaces array)]
    └──requires──> [Sidebar UI: space switcher component]
    └──enhances──> [Multi-account] (accounts are naturally per-space)
    └──enhances──> [Keyboard shortcuts] (per-space index navigation)

[Multi-account]
    └──requires──> [Session isolation per account instance (data_directory workaround)]
    └──depends-on──> [Spaces] (accounts live within a space context)
    └──NOTE: Tauri browser profiles (#9285) open/unimplemented — workaround path only

[Split view]
    └──requires──> [Tauri unstable multi-webview API — validate first]
    └──requires──> [LRU pool adjustment (split uses 2 slots simultaneously)]
    └──conflicts──> [Single active app model (state machine change needed)]

[Notifications]
    └──requires──> [tauri-plugin-notification installed + permissions]
    └──requires──> [Webview Notification API interception (JS bridge)]
    └──enhances──> [Dock badge count]

[Dock badge count]
    └──requires──> [Tauri setBadgeCount() — verify bug status #13905]
    └──depends-on──> [Notifications OR unread count badge (source of count)]

[Preferences panel]
    └──requires──> [preferences.json schema + file persistence]
    └──enhances──> [Themes (CSS variable switching)]
    └──independent-of──> [Spaces/Multi-account]

[Code signing]
    └──requires──> [Apple Developer account ($99/yr) for macOS notarization]
    └──requires──> [Windows: Azure Trusted Signing or OV cert (geo-gated)]
    └──independent-of──> [all feature flags — ops-only change]
    └──blocks──> [Polished distribution UX on macOS and Windows]

[Animations / Polish]
    └──requires──> [Motion (framer-motion) library]
    └──enhances──> [Spaces] (space switch transition)
    └──enhances──> [Preferences panel] (open/close animation)
    └──independent-of──> [core features]
```

### Dependency Notes

- **Persistent Sessions requires stable app identity:** The webview data partition key must be deterministic (e.g., based on app URL or app ID in JSON). If the key changes, users lose all sessions.
- **Lazy Loading requires LRU cache:** Simply destroying all inactive webviews creates bad UX (slow restore). Keep the last N (e.g., 3-5) webviews alive, destroy the rest.
- **Startup < 1s conflicts with pre-loading:** Don't create webviews at startup. Create the webview on first user click to that app. Show a loading indicator.
- **Extension support conflicts with native webview:** This is a hard architectural conflict. Supporting extensions requires Chromium, which eliminates the RAM and startup advantages.
- **File-based config is a foundation dependency:** App groups, drag-and-drop, add/remove, and spaces/profiles all read from and write to the same JSON file. The schema must be designed for forward-compatibility.
- **Multi-account requires workaround, not clean API:** Tauri browser profiles (#9285) is open and unimplemented. The `data_directory` per-instance workaround may have edge cases on macOS. Needs hands-on prototype validation before committing to a phase.
- **Split view requires unstable Tauri API:** PR #8280 merged Jan 2024, but positioned behind `unstable` flag with known z-index/positioning bugs (#10420). Achievable (Bushido browser does it) but requires a validation spike.

---

## MVP Definition

### v1.0 (Already Shipped)

- [x] Sidebar with icons + labels
- [x] App groups in sidebar
- [x] WebView per app with lazy loading, LRU pool (8 max)
- [x] Persistent sessions (per-app isolation)
- [x] File-based config (`~/.nexus/apps.json`)
- [x] Keyboard shortcuts (Cmd+1-9, Cmd+B, Cmd+R, Cmd+K)
- [x] Command palette with fuzzy search
- [x] Drag & drop reorder
- [x] External links to system browser
- [x] Activity badge (dot on title change)
- [x] Dark mode + Arc-inspired minimal aesthetic
- [x] Cross-platform: macOS universal, Linux .deb/.AppImage, Windows NSIS
- [x] Auto-updates via tauri-plugin-updater

### v2.0 Core (Current Milestone — Ship These)

Must ship for this milestone to deliver on "workspace manager" evolution:

- [ ] Spaces — foundational workspace concept; all other v2 features build on this
- [ ] Preferences panel — appearance customization; CSS variables + preferences.json
- [ ] Smooth animations — polish pass; low cost, high perception value
- [ ] Unread count badge (numeric) — extend existing dot-badge; title parse for numbers
- [ ] Native OS notifications — `tauri-plugin-notification` + JS bridge injection
- [ ] Code signing (macOS) — notarization for clean install; Apple Developer account required

### v2.0 Conditional (Validate Before Committing)

These require technical validation spikes before committing to a phase:

- [ ] Multi-account — validate `data_directory` workaround on macOS/Windows/Linux; Tauri profiles API not ready
- [ ] Split view — validate Tauri unstable multi-webview API on all 3 platforms; known positioning bugs

### v2.x Add-ons (After Core Stable)

- [ ] Code signing (Windows) — Azure Trusted Signing geo-gated (US/Canada only); document OV cert fallback
- [ ] Dock badge count — verify `setBadgeCount` bug (#13905) resolution before relying on it
- [ ] Per-space themes — Spaces must be stable before per-space visual differentiation adds value

---

## Feature Prioritization Matrix (v2.0 Scope)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Spaces | HIGH | MEDIUM | P1 |
| Preferences panel | HIGH | LOW | P1 |
| Native OS notifications | HIGH | MEDIUM | P1 |
| Smooth animations / polish | MEDIUM | LOW | P1 |
| Unread count badge (numeric) | MEDIUM | LOW | P1 |
| Code signing (macOS) | HIGH (distribution) | LOW-MEDIUM (ops) | P1 |
| Multi-account | HIGH | HIGH | P2 — validate first |
| Split view | MEDIUM | HIGH | P2 — validate API stability |
| Dock badge count | LOW-MEDIUM | LOW | P2 — depends on notifications |
| Code signing (Windows) | MEDIUM | MEDIUM | P2 — geo-gated option |

**Priority key:**
- P1: Must have for v2.0 release
- P2: Should have, add when core is stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Arc Browser | Wavebox | Franz/Rambox | Nexus v2.0 Approach |
|---------|-------------|---------|--------------|---------------------|
| Spaces / workspaces | Yes — icon dots at sidebar bottom, Cmd+S switch, per-space profile | Yes — full workspace isolation with cookie separation | Yes (Workspaces) | Named spaces in sidebar footer, JSON-backed, keyboard shortcut switching |
| Multi-account | Yes — per-space profiles | Yes — headline feature, multiple logins per app | Yes (instances) | Per-account `data_directory` isolation; Tauri profiles feature pending |
| Split view | Yes — side-by-side tabs | No | No | Two-webview layout via Tauri unstable multi-webview API |
| Native notifications | Yes (browser) | Yes | Yes | `tauri-plugin-notification` + JS bridge in webviews |
| Dock badge count | macOS only | Yes | Yes | `setBadgeCount()` (verify bug #13905 status) |
| Preferences / themes | Yes — per-space colors | Yes — themes | Limited | CSS variables + preferences panel + JSON persistence |
| Code signing | N/A (Electron-based) | N/A | N/A | macOS notarization + Windows Azure Trusted Signing |
| Binary size | ~200MB (Chromium) | ~150MB | ~120MB | ~5MB (Tauri native webview) — major differentiator |

**Key insight:** No competitor uses native webviews + file-based config + low RAM as a unified value prop. Nexus's differentiator is the combination of (1) Tauri native webviews for RAM/speed, (2) JSON config for power users, and (3) Arc-quality UX aesthetics.

---

## v2.0 Implementation Risk Notes

### Multi-account: Tauri browser profiles not ready
Tauri issue #9285 (browser profiles) is open and unimplemented as of March 2026. Implementation requires upstream work in the `wry` crate. Current workaround is separate `data_directory` per account instance. This works for session persistence but may have edge cases on macOS where `WKWebsiteDataStore` behavior is not fully controllable via directory path alone. **Recommendation:** Build a prototype and validate before committing to a shipping phase.

### Split view: Unstable API with known bugs
Tauri's multi-webview-in-one-window feature (PR #8280, merged Jan 2024) is behind the `unstable` feature flag. Known issue #10420 documents child webviews overlaying each other with z-index problems. The Bushido browser project demonstrates 4-pane recursive split is achievable, but it requires explicit engineering effort. LRU pool logic also needs updating since split view requires 2 active webviews simultaneously. **Recommendation:** Dedicate a research spike at phase start before committing to design.

### Code signing (Windows): Geography and cost constraints
Azure Trusted Signing (the preferred no-SmartScreen path) is currently available only to US/Canada organizations with 3+ years of business history. OV certificates (cheaper) still trigger SmartScreen warnings. **Recommendation:** macOS notarization is straightforward and high-value. Windows signing is a "do when possible" item — document the right-click workaround for early users.

### setBadgeCount bug (macOS)
GitHub issue #13905 (July 2025) reports `setBadgeCount` not working on macOS. Verify against current Tauri version before including dock badge count in a committed phase.

---

## Sources

### v1.0 Research Sources
- [Station GitHub (open source)](https://github.com/getstation/desktop-app)
- [Wavebox features](https://wavebox.io/features)
- [Ferdium GitHub](https://github.com/ferdium/ferdium-app)
- [Rambox features](https://rambox.app/features/)
- [Wavebox alternatives (AlternativeTo)](https://alternativeto.net/software/wmail/)

### v2.0 Research Sources
- [Tauri Notification Plugin — Official Docs](https://v2.tauri.app/plugin/notification/)
- [Tauri Webview JS API Reference](https://v2.tauri.app/reference/javascript/api/namespacewebview/)
- [Tauri macOS Code Signing — Official Docs](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri Windows Code Signing — Official Docs](https://v2.tauri.app/distribute/sign/windows/)
- [PR #8280 — Multiple webviews in one window (merged Jan 2024)](https://github.com/tauri-apps/tauri/pull/8280)
- [Issue #9285 — Browser profiles support (open, unimplemented)](https://github.com/tauri-apps/tauri/issues/9285)
- [Issue #11491 — Enhanced WebView isolation (closed as duplicate of #9285)](https://github.com/tauri-apps/tauri/issues/11491)
- [Commit 020ea05 — Badging API implementation](https://github.com/tauri-apps/tauri/commit/020ea05561348dcd6d2a7df358f8a5190f661ba2)
- [Issue #13905 — setBadgeCount bug (July 2025)](https://github.com/tauri-apps/tauri/issues/13905)
- [Wavebox Spaces — Competitor reference](https://hub.wavebox.io/spaces/)
- [Arc Browser UX analysis — LogRocket](https://blog.logrocket.com/ux-design/ux-analysis-arc-opera-edge/)
- [Windows code signing guide — DEV Community](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n)
- [Windows code signing Certum HSM — Defguard](https://defguard.net/blog/windows-codesign-certum-hsm/)
- [Motion (Framer Motion) official site](https://motion.dev/)

---

*Feature research for: Desktop web-app browser (unified launcher) — v1.0 + v2.0 Power Features*
*Researched: 2026-03-18 (v1.0) / 2026-03-20 (v2.0 update)*

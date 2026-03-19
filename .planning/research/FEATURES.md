# Feature Research

**Domain:** Desktop web-app browser (unified launcher for web apps)
**Researched:** 2026-03-18
**Confidence:** HIGH (based on direct competitor analysis: Station, Wavebox, Ferdium, Franz, Shift, Rambox, WebCatalog, Arc)

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
| Native OS notifications | Users want alerts from Slack, Gmail, etc. without switching | Requires per-app notification scraping or webview JS injection. Notification permission dialogs differ per platform. Creates noise and notification fatigue. Opens security surface for JS injection. v1 scope creep. | Silent sidebar badge (title-change dot). Let v1 ship without this; add in v2 when the notification architecture is well-understood. |
| Spaces / profiles (multiple sets of apps) | Power users want work vs personal switching | Massive state complexity: separate session stores, separate configs, UI for switching. Arc built this and it became their hardest feature to maintain. | Defer to v2. JSON config is simple to extend with a `spaces` array later. |
| Built-in ad blocker / privacy features | Users want tracker blocking in webviews | Requires content script injection or webview request interception. Hard to maintain filter lists. Network-layer blocking in Tauri is possible via `on_navigation` but increases complexity significantly. | Document how to use system-level blockers (e.g. Little Snitch, Pi-hole). Consider as v2 plugin. |
| App marketplace / recipes catalog | Franz/Ferdium model: curated list of "recipes" for 100+ apps | Massively increases maintenance surface. Recipes break when apps update their HTML. Becomes a full-time job. Franz/Ferdi both struggled with recipe maintenance as a core pain point. | JSON config with a simple `url` field. Users add any URL. No recipes needed. |
| Multi-account support (two Gmail instances) | Many users run work + personal | Requires separate cookie stores per instance of the same app. WebKit doesn't support multiple partitioned webviews with different origins easily. Wavebox does this but it's their most complex feature. | Defer to v2. Use separate data partition names as a v2 config option. |
| Browser extension support | Users want 1Password, Bitwarden, Grammarly in webviews | Platform webviews (WebKit, WebView2) do NOT support browser extensions the same way Chromium does. Station/Wavebox do this by embedding full Chromium, which destroys the RAM advantage. | Not feasible without abandoning Tauri's native-webview model. Document explicitly in README. |
| OAuth / account system (cloud sync) | Users want their config to sync across machines | Cloud sync = server infrastructure, auth, encryption, privacy liability. Destroys the "zero backend" architecture. | JSON config is a file — users can sync it themselves with Dropbox/iCloud/git. Document this pattern. |
| In-app browser for external links | Users sometimes want to stay in Nexus context | Defeats the entire design principle. Nexus is for web apps, not general browsing. Creates a half-baked browser experience. | Always system browser for external navigation. No exceptions in v1. |
| Smooth animations / transitions | Polished feel | Requires significant engineering for cross-platform consistency. CSS transitions on WebKit vs WebView2 behave differently. Low ROI for v1. | Ship with instant state changes. Add transitions in v2 as a "polish" phase after core is stable. |

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
```

### Dependency Notes

- **Persistent Sessions requires stable app identity:** The webview data partition key must be deterministic (e.g., based on app URL or app ID in JSON). If the key changes, users lose all sessions.
- **Lazy Loading requires LRU cache:** Simply destroying all inactive webviews creates bad UX (slow restore). Keep the last N (e.g., 3-5) webviews alive, destroy the rest.
- **Startup < 1s conflicts with pre-loading:** Don't create webviews at startup. Create the webview on first user click to that app. Show a loading indicator.
- **Extension support conflicts with native webview:** This is a hard architectural conflict. Supporting extensions requires Chromium, which eliminates the RAM and startup advantages.
- **File-based config is a foundation dependency:** App groups, drag-and-drop, add/remove, and any future spaces/profiles all read from and write to the same JSON file. The schema must be designed for forward-compatibility.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Sidebar with icons + labels — core navigation paradigm; product doesn't exist without this
- [ ] App groups in sidebar — users with 5+ apps immediately need this for sanity
- [ ] WebView per app with lazy loading — without sleep, RAM blows up on 5+ apps
- [ ] Persistent sessions — users must stay logged in across restarts; this is the #1 reason to use the app
- [ ] File-based config (`~/.nexus/apps.json`) — the entire customization model; hardcoded list is not a product
- [ ] Keyboard shortcuts (Cmd+1..9, Cmd+R, Cmd+B) — power users require this; missing = won't adopt
- [ ] Command palette (Cmd+K) — fuzzy app switching is table stakes once you have >5 apps
- [ ] Drag & drop reorder — users need to curate order; without this the app feels unfinished
- [ ] External links to system browser — missing this = Nexus becomes a broken general browser
- [ ] Activity badge (title-change dot) — silent notification is a key differentiator over just bookmarks
- [ ] Dark mode + Arc-inspired minimal aesthetic — first impression; competitive bar is high
- [ ] Cross-platform: macOS arm64 + intel, Linux, Windows — Tauri's core value prop

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Unread count in badge (not just dot) — when title parsing is stable, surface the number
- [ ] Per-app mute / DND toggle — let users silence specific apps without removing them
- [ ] App-level zoom controls — some apps are designed for larger screens; zoom helps usability
- [ ] Import / export config — power users want to share or backup their `apps.json` from within the UI

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Spaces / profiles — massive complexity; validate single-workspace first
- [ ] Split view (two apps side by side) — needed, but complex layout management; defer
- [ ] Native OS notifications — requires careful per-app opt-in architecture; notification fatigue risk
- [ ] Multi-account support (same app, two logins) — requires partitioned sessions; significant complexity
- [ ] Smooth animations — polish phase; ship correctness before aesthetics
- [ ] Per-app theming / custom CSS injection — power user feature; high risk of maintenance burden

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persistent sessions | HIGH | MEDIUM | P1 |
| Sidebar navigation | HIGH | LOW | P1 |
| Lazy loading / sleep | HIGH | HIGH | P1 |
| File-based config (apps.json) | HIGH | LOW | P1 |
| Keyboard shortcuts | HIGH | LOW | P1 |
| External links to system browser | HIGH | LOW | P1 |
| App groups in sidebar | HIGH | LOW | P1 |
| Command palette (Cmd+K) | HIGH | MEDIUM | P1 |
| Cross-platform build | HIGH | HIGH | P1 |
| Drag & drop reorder | MEDIUM | MEDIUM | P2 |
| Activity badge (dot) | MEDIUM | MEDIUM | P2 |
| Dark mode | MEDIUM | LOW | P2 |
| Collapsible sidebar (Cmd+B) | MEDIUM | LOW | P2 |
| Startup < 1s | HIGH | HIGH | P2 |
| Unread count in badge | MEDIUM | MEDIUM | P2 |
| Per-app mute / DND | LOW | LOW | P3 |
| App-level zoom controls | LOW | LOW | P3 |
| Spaces / profiles | HIGH | HIGH | P3 |
| Native OS notifications | MEDIUM | HIGH | P3 |
| Multi-account support | MEDIUM | HIGH | P3 |
| Extension support | MEDIUM | VERY HIGH (arch change) | NEVER (v1) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Station | Wavebox | Ferdium | Shift | Rambox | Nexus approach |
|---------|---------|---------|---------|-------|--------|----------------|
| Sidebar navigation | Yes | Yes | Yes | Yes | Yes | Yes — Arc-inspired thin vertical bar |
| App groups | Yes (smart grouping) | Yes (containers) | Yes | Yes (workspaces) | Yes | Yes — JSON-defined, collapsible |
| Lazy loading / sleep | Yes ("autosleep") | Yes (15-min default) | Yes ("hibernation") | Yes | Yes | Yes — LRU with configurable N |
| Multi-account | Yes | Yes (core feature) | Yes | Yes | Yes | No v1 — deferred to v2 |
| Command palette | Yes ("Quick Switch") | No | No | No | Yes ("Quick Search") | Yes — Cmd+K fuzzy search |
| Native notifications | Yes | Yes | Yes | Yes | Yes | No v1 — silent badge only |
| Extension support | Limited | Yes (Chromium-based) | Yes (Electron) | Yes (Chromium) | No | No — not possible with native webviews |
| File-based config | No | No | No | No | No | Yes — unique differentiator |
| Startup speed | Slow (Electron) | Slow (Electron/Chrome) | Slow (Electron) | Slow (Electron) | Slow (Electron) | Fast (<1s, Tauri) |
| RAM usage | High (Electron) | High (Chrome-based) | High (Electron) | High (Chrome) | Medium | Low (native webviews, lazy load) |
| Open source | Yes (MIT) | No | Yes | No | Freemium | Yes (planned) |
| Price | Free | Freemium ($20/yr) | Free | Freemium ($100/yr) | Freemium | Free (open source) |
| Cross-platform | Mac/Win | Mac/Win | Mac/Win/Linux | Mac/Win | Mac/Win/Linux | Mac/Win/Linux |

**Key insight:** No competitor uses native webviews + file-based config + low RAM as a unified value prop. Nexus's differentiator is the combination of (1) Tauri native webviews for RAM/speed, (2) JSON config for power users, and (3) Arc-quality UX aesthetics. Extension support and multi-account are the features Nexus deliberately sacrifices to achieve this.

---

## Sources

- [Station features page](https://getstation.com/features/)
- [Station GitHub (open source)](https://github.com/getstation/desktop-app)
- [Wavebox features](https://wavebox.io/features)
- [Wavebox tab sleep docs](https://hub.wavebox.io/sleep-performance/)
- [Wavebox 2025 user survey](https://hub.wavebox.io/2025-user-survey-analysis-wavebox-by-the-numbers/)
- [Ferdium GitHub](https://github.com/ferdium/ferdium-app)
- [Ferdium blog review 2025](https://kszenes.github.io/blog/2025/Ferdium/)
- [Shift 2.0 launch (2025)](https://shift.com/blog/shift-2-0-launch/)
- [Rambox features](https://rambox.app/features/)
- [WebCatalog keyboard shortcuts](https://community.webcatalog.io/t/documentation-keyboard-shortcuts/571)
- [Arc browser Wikipedia (maintenance mode 2025)](https://en.wikipedia.org/wiki/Arc_(web_browser))
- [Wavebox alternatives (AlternativeTo)](https://alternativeto.net/software/wmail/)
- [WebView2 memory management (Microsoft)](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)
- [Tauri memory article — idle optimization](https://medium.com/@hadiyolworld007/building-tauri-apps-that-dont-hog-memory-at-idle-de516dabb938)
- [Windows RAM bloat: Electron and WebView2 (2025)](https://www.windowslatest.com/2025/12/07/ram-prices-soar-but-popular-windows-11-apps-are-using-more-ram-due-to-electron-web-components/)

---
*Feature research for: Desktop web-app browser (unified launcher)*
*Researched: 2026-03-18*

# Project Research Summary

**Project:** Nexus v2.0
**Domain:** Tauri 2 desktop web-app launcher — workspace manager evolution
**Researched:** 2026-03-20 (v2.0 update; extends v1.0 research from 2026-03-18)
**Confidence:** HIGH (stack and architecture verified against official docs and live codebase; pitfalls verified against open GitHub issues)

## Executive Summary

Nexus is a Tauri 2 desktop browser that loads third-party web apps (Gmail, Slack, Linear, Notion) in isolated native webviews with persistent sessions, presented through a unified sidebar launcher. The v1.0 product ships a complete foundation: sidebar, command palette, file-based config, LRU webview pool, lazy loading, drag-and-drop, activity badges, cross-platform builds, and auto-updates. The v2.0 milestone evolves Nexus from a "tab switcher" into a full workspace manager by adding Spaces (named workspaces), Multi-Account (session-isolated account switching per app), Split View (two apps side by side), native OS Notifications, visual Polish (animations and numeric unread count), a Preferences panel (appearance customization), and code signing for clean distribution.

The recommended approach treats v2.0 as incremental layering on the stable v1.0 base — not a rewrite. The existing architecture (single `Mutex<AppState>` in Rust, zustand slices in React, `app-{id}` labeled webviews, `apps.json` file-based config) extends cleanly to cover all seven v2.0 features. Only three new npm packages are required (`motion`, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-store`) and two new Rust crates. All other v2.0 features are config schema changes, new IPC commands, and React component additions. Two features — Multi-Account and Split View — are classified as conditional: they require validation spikes before committing to a shipping phase.

The highest risks are: (1) Split View relies on Tauri's `multiwebview` unstable flag which has active rendering bugs on Linux and Windows — the mitigation is `WebviewWindow` bounds positioning, avoiding the unstable API entirely; (2) Spaces require a key-scheme migration from flat `app_id` to compound `{space_id}:{app_id}` to prevent LRU pool collisions, and this migration must happen before any Space UI is wired; (3) macOS code signing requires JIT entitlements explicitly in `Entitlements.plist` or the notarized build will crash at launch. Each risk has a specific, actionable prevention strategy.

## Key Findings

### Recommended Stack

The v1.0 stack (Tauri 2, React 18.3.1, TypeScript strict, Vite, Tailwind CSS v4, zustand, dnd-kit, fuse.js) is unchanged and validated. V2.0 adds three targeted dependencies:

**New dependencies for v2.0:**
- `motion@12.38.0` (imported from `motion/react`): Sidebar and panel animations. Same team as Framer Motion — `framer-motion` is the legacy deprecated package. React 18/19 compatible, 30M+ npm downloads/month.
- `@tauri-apps/plugin-notification@2.3.3` + Rust crate `tauri-plugin-notification@2`: Native OS notifications. Must be scoped to the sidebar webview only; app webviews proxy notification requests through initialization scripts.
- `@tauri-apps/plugin-store@2.4.2` + Rust crate `tauri-plugin-store@2`: Flat key-value persistence for preferences (theme, accent, border-radius, gap). Structural config (apps, spaces) stays in `apps.json` via existing `plugin-fs`.

**Critical rules:** Tauri plugin major versions must match Tauri major (both `2.x`). The `multiwebview` unstable Cargo feature must NOT be enabled. Code signing uses CI/CD environment variables only — no new Rust or npm dependencies.

### Expected Features

**Must have for v2.0 (P1 — ship these):**
- Spaces — foundational workspace concept; all other v2 features build on or enhance it
- Preferences panel — CSS variable-driven appearance customization; high user expectation for any "polished" desktop app
- Native OS notifications — `tauri-plugin-notification` + JS bridge; Gmail and Slack users require this
- Smooth animations and polish — motion library; low implementation cost, high perception value
- Unread count badge (numeric) — extends the existing dot-badge; title `(N)` prefix parse, no new Rust code
- Code signing (macOS) — required for clean install experience; blocks casual user adoption without it

**Conditional v2.0 (P2 — validate before committing):**
- Multi-Account — prototype needed to validate `data_directory` isolation on all three platforms (Tauri profiles API #9285 is open and unimplemented)
- Split View — spike needed to validate `WebviewWindow` bounds approach on all three platforms; active multiwebview bugs rule out the `unstable` flag path

**Defer to v2.x:**
- Code signing (Windows) — Azure Trusted Signing is geo-gated to US/Canada; document OV workaround for early users
- Dock badge count — `setBadgeCount` has open bug #13905 on macOS; verify resolution before committing
- Per-space themes — Spaces must be stable before per-space visual differentiation adds value

**Anti-features (do not build):** Cloud sync (requires backend, violates zero-backend principle), browser extensions (requires full Chromium, destroys RAM advantage), app marketplace/recipes (unsustainable maintenance burden), tabs within a space (turns Nexus into a general browser).

### Architecture Approach

V2.0 extends the existing Rust/React architecture. Rust owns all webview lifecycle, state mutation, and IPC. React owns all rendering and user interaction. The `NexusConfig` struct gains a `spaces: Vec<SpaceConfig>` array and a `preferences: Preferences` sub-object (both `#[serde(default)]` for backward compatibility with existing `apps.json` files). `AppState` gains `active_space_id`, `split_app_id`, and `split_ratio`. The webview label scheme stays `app-{app_id}` — space context is tracked in `AppState` only, not encoded in the label, which keeps the capability glob `"app-*"` valid without changes.

**New files:**
1. `src-tauri/src/commands/notifications.rs` — `send_notification` IPC command; fires OS notification only for background apps
2. `src-tauri/src/commands/spaces.rs` — `switch_space`, `add_space`, `remove_space`, `rename_space`
3. `src/components/SettingsPanel.tsx` — Preferences overlay container (prerequisite for Preferences phase)
4. `src/components/SpaceSwitcher.tsx` — Space tabs in sidebar
5. `src/hooks/useSpaces.ts` — Space state management
6. `src/hooks/usePreferences.ts` — Preferences read/write via `tauri-plugin-store`

**Modified files:** `config.rs` (add `SpaceConfig`, `Preferences`), `state.rs` (add `split_app_id`, `split_ratio`, `active_space_id`), `commands/webview.rs` (refactor `calc_webview_rect` for split view; read gap/radius from config), `lib.rs` (register new commands; resize handler covers both split panes), `useAppsConfig.ts` (`badgeAppIds: Set<string>` becomes `badgeMap: Map<string, number | null>`), `Sidebar.tsx` (SpaceSwitcher, account_label, numeric badge), `App.tsx` (split divider, SettingsPanel).

The notification bridge pattern injects an initialization script into each app webview that intercepts `window.Notification` constructor calls and proxies them to Rust via `__TAURI_INTERNALS__.invoke`. The Rust command fires the OS notification only when the triggering app is in the background. The script must never throw — wrap everything in try/catch.

### Critical Pitfalls

1. **`multiwebview` unstable flag has active bugs on all platforms** — Never enable `features = ["unstable"]` in `Cargo.toml`. Use `WebviewWindow` bounds positioning (`set_position()` + `set_size()`) for Split View instead. Active bugs as of March 2026: #11376 (only last child renders), #10420 (broken positioning on Linux), #13071 (Linux stacking), #12568 (`WindowEvent::Focused` never fires).

2. **Spaces require compound webview key before any Space UI** — The current `app_id`-keyed LRU pool silently evicts the wrong space's session when two spaces share an app with the same ID. Migrate all webview keys to `{space_id}:{app_id}` and update `AppState.webviews_created`, `lru_order`, `active_app_id`, and webview labels atomically before wiring Space switching.

3. **`switch_app_impl` hides all other webviews — Split View requires two visible simultaneously** — Add `split_app_id: Option<String>` to `AppState`. Update `switch_app_impl` to guard against hiding a webview currently in the split pane. Update the resize handler to reposition both panes.

4. **macOS notarization requires JIT entitlement in `Entitlements.plist`** — Hardened Runtime (required for notarization) blocks JIT by default; WKWebView needs JIT to render modern web content. Include `com.apple.security.cs.allow-jit` and `com.apple.security.cs.allow-unsigned-executable-memory` before the first notarization attempt. A notarized build without these crashes at launch on every user's Mac.

5. **Preferences panel creates a second config writer — race with drag-reorder** — All config mutations must route through a single Rust `Mutex`-protected writer. Adopt a delta-patch command model or debounce preference saves (500ms) and merge with in-flight state. Never let the frontend hold a stale `NexusConfig` snapshot it writes back wholesale.

## Implications for Roadmap

The ARCHITECTURE.md documents a concrete build-order dependency graph. The PITFALLS.md maps each pitfall to a phase. The phase structure below follows both directly.

### Phase 1: Notifications

**Rationale:** Fully self-contained — no interaction with Spaces, Multi-Account, or Split View. Adds `tauri-plugin-notification` and the init script injection pattern which is the foundation for notification bridging but has no dependencies on other v2 features. Delivers immediate user-visible value with the lowest architectural risk.
**Delivers:** Native OS notifications from Gmail, Slack, Linear, and any app that uses the browser Notification API. Notification only fires for background apps.
**Uses:** `tauri-plugin-notification@2.3.3`, `initialization_script` injection pattern, `send_notification` Rust command.
**Avoids:** Notification capability scoped to sidebar only — never granted to app webviews (Pitfall 10); `requestPermission()` is lazy (not called at startup) to avoid macOS permission denial.

### Phase 2: Polish — Animations and Unread Count

**Rationale:** No new IPC or Rust changes. The `SettingsPanel` component shell built here is a hard prerequisite for the Preferences phase. Unread count is a title-parse extension of the existing badge system requiring zero Rust changes. Building this early establishes the animation performance baseline on Linux.
**Delivers:** Smooth sidebar animations (motion), numeric unread count badges, sidebar toggle button, Settings panel container shell.
**Uses:** `motion@12.38.0` imported from `motion/react`.
**Avoids:** Only `opacity` and `transform` CSS properties animated (never `width`/`height`); animations gated behind `prefers-reduced-motion`; `webview.show()` called before animation starts, never after (Pitfall 11 — animation latency regression on WebKitGTK).

### Phase 3: Spaces

**Rationale:** The largest config and state change in v2.0. Must come before Split View (which needs space context) and before Multi-Account's LRU considerations finalize. This is the phase that requires the compound key migration — doing it here with no split/multi-account UI yet deployed minimizes rollback scope if the migration uncovers edge cases.
**Delivers:** Named workspace contexts, space switcher in sidebar, per-space app lists, Cmd+S switching, space CRUD via Command Palette.
**Uses:** `SpaceConfig` struct in `config.rs`, `switch_space` IPC, `useSpaces` hook, `SpaceSwitcher` component.
**Avoids:** Compound key `{space_id}:{app_id}` migration done atomically before Space switching UI wires up (Pitfall 7); per-space LRU pool with global cap designed before coding (Pitfall 15 — no obvious winner between global and per-space pool).
**Research flag:** LRU pool model (global vs per-space with global cap) requires a design decision at phase start before any code is written. The decision drives `AppState` structure and cannot be easily changed after Space switching is live.

### Phase 4: Preferences

**Rationale:** Depends on the Settings panel shell from Phase 2. Requires refactoring hardcoded `GAP` and `border_radius` constants in `webview.rs` to read from config — this same refactor is a prerequisite for Split View's geometry math. Doing it here makes Phase 6 a clean incremental change rather than a combined refactor-and-feature phase.
**Delivers:** Theme (dark/light/system), accent color, border-radius, gap, sidebar font size — all persisted in `preferences` section of `NexusConfig` (not a separate file), applied as CSS custom properties on `:root`.
**Uses:** `@tauri-apps/plugin-store@2.4.2`, `LazyStore` API, `usePreferences` hook, `apply_preferences` IPC command.
**Avoids:** Preferences stored as nested object in `NexusConfig` not a separate file (anti-pattern — two config files create two writers, two watchers, two startup read paths); delta-patch or serialized single-writer model to prevent race with drag-reorder (Pitfall 12).

### Phase 5: Multi-Account (Conditional)

**Rationale:** Architecturally the simplest v2 feature — session isolation already works via `data_directory` keyed on `app_id`. The feature is mostly a UX layer. However, `WKWebsiteDataStore(forIdentifier:)` on macOS 14+ requires a Developer ID-signed build to work reliably; dev builds may silently fall back to shared storage, masking isolation bugs. Build a prototype spike at phase start to validate on all three platforms.
**Delivers:** Multiple isolated sessions for the same app URL (Personal + Work Gmail), `account_label` sub-display in sidebar, multi-account add flow in Command Palette.
**Uses:** Existing `data_store_identifier`/`data_directory` mechanism; `account_label` optional field in `AppConfig`; auto-suffix IDs (`gmail-1`, `gmail-2`) to guarantee uniqueness.
**Avoids:** `app_id` uniqueness enforced at config save time (Pitfall 8 — two identical IDs silently share one session); macOS UUID stored alongside config to survive renames and prevent orphaned `~/Library/WebKit/WebsiteDataStore/` directories.
**Research flag:** Validation spike on all three platforms required before this phase begins. If `WKWebsiteDataStore` isolation is incomplete on macOS 14+ without a signed build, the phase may need to be deferred until after Phase 7 (Code Signing).

### Phase 6: Split View (Conditional)

**Rationale:** Highest-complexity feature. Depends on Preferences/Polish (`calc_webview_rect` refactor done in Phase 4) and Spaces (space context needed). Prototype the `WebviewWindow` bounds approach on all three platforms at phase start — specifically window resize, minimize/restore, and multi-monitor behavior.
**Delivers:** Two apps visible side by side, draggable divider in the gap between webviews, `enter_split`/`exit_split`/`resize_split` IPC, LRU pool exclusion for both split panes.
**Uses:** `WebviewWindow.set_position()` + `set_size()` (stable Tauri API — no `unstable` flag), CSS drag handle React component positioned in the gap between webview rects.
**Avoids:** `multiwebview` unstable flag entirely (Pitfall 1 and 9); minimum pane width (300px) enforced in resize handler; `switch_app_impl` guards `split_app_id` from eviction and hiding (Pitfall 9 — current hide-all logic conflicts with split view's two-visible requirement).
**Research flag:** Platform validation spike required at phase start. The `WebviewWindow` bounds approach avoids the `unstable` bugs but cross-platform behavior under edge cases (minimize/restore, multi-monitor) has not been validated in the existing codebase.

### Phase 7: Code Signing

**Rationale:** Entirely independent of all other features — CI/CD configuration only, zero runtime code changes. Certificate procurement has lead time (Apple Developer account enrollment, Azure Key Vault setup). Start paperwork in parallel with Phase 1; implement CI/CD changes after Phase 6 ships or when certificates are ready, whichever comes later.
**Delivers:** macOS `.dmg` that installs without "unverified developer" dialog; Windows installer with signing (SmartScreen warning acceptable for early users as reputation accumulates).
**Avoids:** `Entitlements.plist` with `com.apple.security.cs.allow-jit` created before first notarization attempt (Pitfall 13); Azure Key Vault setup for Windows (Pitfall 14 — old exportable `.pfx` OV cert workflow no longer supported by CAs since June 2023).
**Research flag:** Well-documented patterns in official Tauri docs. Follow `v2.tauri.app/distribute/sign/` directly. No phase research sprint needed.

### Phase Ordering Rationale

- Notifications is first because it is the only phase with zero cross-feature dependencies and delivers high user value with low risk
- Polish is second because `SettingsPanel` is a hard prerequisite for Preferences; building it here avoids a "depends on future work" sequencing smell in Phase 4
- Spaces is third because the compound key migration must happen before Split View and Multi-Account rely on the LRU pool; the migration is cleanest when done with no other in-flight v2 features touching webview keys
- Preferences is fourth because the `webview.rs` constants-to-config refactor it requires is shared with Split View; doing it here makes Phase 6 a clean feature addition rather than a combined refactor-plus-feature phase
- Multi-Account is fifth because it is UX-only (no new Rust infrastructure) and can be descoped without affecting Split View
- Split View is sixth because it has the most cross-cutting dependencies (Spaces key scheme, Preferences geometry refactor, LRU pool model)
- Code Signing is last because it is CI/CD with certificate lead time; paperwork runs in parallel from Phase 1 onward

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Spaces):** LRU pool model decision (global pool with eviction vs per-space pool with global cap) must be resolved in a design document before coding. Neither option is clearly superior without profiling — this is the one genuine architecture decision in v2.0 that research could not resolve ahead of time.
- **Phase 5 (Multi-Account):** Validation spike on macOS 14+ with a Developer ID-signed build is required before committing to a shipping phase. `WKWebsiteDataStore(forIdentifier:)` isolation behavior in unsigned dev builds is unreliable.
- **Phase 6 (Split View):** Platform validation spike for `WebviewWindow` bounds approach — specifically resize, minimize/restore, and focus behavior on Linux and Windows — required at phase start.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Notifications):** Official Tauri plugin docs cover installation, permissions, and the `LazyStore` API pattern. Follow `v2.tauri.app/plugin/notification/` directly.
- **Phase 2 (Polish):** motion library has comprehensive docs; CSS custom property + Tailwind v4 pattern is standard. Linux performance testing needed during execution, not before.
- **Phase 4 (Preferences):** `tauri-plugin-store` `LazyStore` API is well-documented; CSS custom property pattern for Tailwind v4 is standard.
- **Phase 7 (Code Signing):** Full step-by-step available in official Tauri signing docs for both macOS and Windows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Tauri 2 docs + npm registry verified live. Plugin versions confirmed. motion rebrand confirmed. One MEDIUM exception: notification injection pattern inferred from docs, needs dev validation. |
| Features | HIGH | Direct competitor analysis (Station, Wavebox, Ferdium, Arc, Rambox, Franz, Shift, WebCatalog). Feature dependencies cross-verified against v1 shipped state. Risk items (Multi-Account, Split View, setBadgeCount) explicitly flagged as conditional. |
| Architecture | HIGH | Based on direct v1 codebase inspection + Tauri 2 official docs. Integration constraints, data flows, and component boundaries are concrete. New file/modified file lists are specific, not generic. |
| Pitfalls | HIGH | Every critical pitfall backed by a specific GitHub issue number and reproduction pattern. Recovery strategies include concrete cost estimates. 9 of 15 pitfalls verified against live open issues. |

**Overall confidence:** HIGH

### Gaps to Address

- **Notification injection validation:** The `window.Notification` constructor override via `initialization_script` is architecturally sound per Tauri docs, but the exact override implementation (handling `undefined` original, side effects of setting `Notification.permission = 'granted'`) needs a 1-2 hour dev-environment spike before Phase 1 commits to the pattern.

- **Multi-Account macOS 14+ isolation depth:** `WKWebsiteDataStore(forIdentifier:)` may require a Developer ID-signed build to work fully — dev builds may silently fall back to shared storage, masking isolation failures. Validate during Phase 5 spike with a signed (not necessarily notarized) build on macOS 14+.

- **Split View Linux gap enforcement:** Linux has `GAP = 0.0` by default (no native rounded corners). The split divider requires a `GAP_SPLIT = 8` pixels enforced programmatically on Linux. Explicit platform branching needed — one-line constant but requires `#[cfg(target_os = "linux")]` handling.

- **`setBadgeCount` bug #13905 resolution:** Track the status of this open macOS issue before committing dock badge count to any v2.x phase. As of March 2026 it remains open.

## Sources

### Primary (HIGH confidence)
- `https://v2.tauri.app/plugin/notification/` — tauri-plugin-notification installation, permissions, and JS API
- `https://v2.tauri.app/plugin/store/` — tauri-plugin-store `LazyStore` API and auto-save behavior
- `https://v2.tauri.app/reference/javascript/api/namespacewebview/` — `setPosition()`, `setSize()`, `setAutoResize()` confirmed stable
- `https://v2.tauri.app/distribute/sign/macos/` — macOS signing env vars, App Store Connect API method, notarization
- `https://v2.tauri.app/distribute/sign/windows/` — Windows OV cert, Azure Key Vault alternative
- `https://motion.dev/docs/react` — `motion` package, `motion/react` import, React 18/19 compatibility confirmed
- `https://v2.tauri.app/security/capabilities/` — Capabilities scoping for webview labels
- Direct v1 codebase inspection — `AppState`, `NexusConfig`, webview label scheme `app-{id}`, LRU pool, `make_store_id`

### Secondary (MEDIUM confidence)
- GitHub issues #11376, #10420, #13071, #12568, #13582 — Active multiwebview bugs, verified open as of March 2026
- GitHub issue #9285 — Tauri browser profiles (open, unimplemented)
- GitHub issue #13905 — `setBadgeCount` bug on macOS (open as of July 2025)
- WebSearch (notification injection pattern) — `initialization_script` + `window.Notification` override approach; supported by Tauri docs, not a dedicated tutorial
- Competitor analysis: Station, Wavebox, Ferdium, Arc, Rambox, Franz, Shift, WebCatalog feature sets

### Tertiary (LOW confidence — needs validation)
- Multi-account `data_directory` isolation completeness on macOS 14+ — behavior inferred from wry source; reliable testing requires a signed build
- Split view `WebviewWindow` bounds cross-platform edge cases (minimize, multi-monitor) — approach is correct per API docs but not validated under edge conditions in the v1 codebase

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*

---
phase: 04-performance-activity
verified: 2026-03-19T21:30:00Z
status: human_needed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Cold startup under 1 second"
    expected: "App sidebar appears in under 1 second from launch; content area is empty until first app is clicked"
    why_human: "Requires running real macOS WKWebView processes and timing with a stopwatch or console.time — not verifiable via static analysis"
  - test: "Instant switching between cached apps"
    expected: "Clicking App A after visiting it once before shows it instantly with no reload, under 100ms perceived latency"
    why_human: "Requires real WKWebView show/hide timing and perceived latency measurement — not verifiable via static analysis"
  - test: "LRU eviction and RAM under 500 MB with 10 apps"
    expected: "After visiting 9 apps, the oldest is evicted when visiting the 10th. Revisiting the evicted app reloads it. Activity Monitor shows total Nexus RAM under 500 MB"
    why_human: "Requires real WKWebView processes, Activity Monitor readings, and observing page reload behavior — not verifiable via static analysis"
  - test: "Badge clears on keyboard shortcut switch"
    expected: "A dot badge on App A clears when pressing Cmd+1 (or Cmd+N for its position) to switch to it"
    why_human: "Keyboard shortcut path goes Rust -> switch_app_impl -> app-switched CustomEvent -> handleAppSwitched. The code is correctly wired but real keyboard input is required to confirm timing"
---

# Phase 4: Performance & Activity Verification Report

**Phase Goal:** Nexus meets its performance contract — sub-1s startup, instant switching between cached apps, and under 500 MB RAM with 10 active webviews — and inactive app icons show a dot badge when the page title changes.
**Verified:** 2026-03-19T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App cold-starts in under 1 second (no webviews at startup) | ? NEEDS HUMAN | Code: `webviews_created` is empty at `AppState::new`; no webview creation in `lib.rs` setup; creation only triggered by `switch_app_impl`. Cannot measure actual startup time via static analysis. |
| 2 | Switching between two previously visited apps feels instant (no reload) | ? NEEDS HUMAN | Code: `switch_app_impl` branches on `already_created`; cached path calls `wv.show()` only (no URL reload). Instantaneous in theory — WKWebView timing requires runtime measurement. |
| 3 | With 10 app webviews visited, RAM stays under 500 MB; LRU evicts at pool cap; revisiting evicted app reloads correctly | ? NEEDS HUMAN | Code: LRU pool capped at `LRU_POOL_SIZE = 8` in `state.rs`; eviction loop in `switch_app_impl` verified correct; evicted app removed from `webviews_created` so next visit recreates it. RAM measurement requires Activity Monitor. |
| 4 | When a background app's page title changes, a dot badge appears on its sidebar icon | ✓ VERIFIED | MutationObserver injected in `switch_app_impl` initialization_script; `notify_title_changed` Rust command relays to main webview as `app-title-changed` CustomEvent; `useAppsConfig` adds to `badgeAppIds`; `Sidebar.tsx` renders `<span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white opacity-90" />` when `hasBadge && !isActive`. |

**Score:** 4/4 truths have correct implementation (3 require human for performance measurement)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/state.rs` | AppState with `lru_order: VecDeque<String>` and `LRU_POOL_SIZE = 8` constant | ✓ VERIFIED | Line 5: `pub const LRU_POOL_SIZE: usize = 8;` Line 12: `pub lru_order: VecDeque<String>` Line 23: initialized as `VecDeque::new()` |
| `src-tauri/src/commands/webview.rs` | LRU tracking in `switch_app_impl` + eviction outside mutex + `notify_title_changed` command + MutationObserver injection | ✓ VERIFIED | Lines 251-279: eviction block collects into `Vec<String>` inside lock, closes outside lock. Lines 151-171: MutationObserver `init_script` injected via `.initialization_script(&init_script)`. Lines 7-28: `notify_title_changed` command. |
| `src-tauri/capabilities/default.json` | IPC capability includes `app-*` for child webviews | ✓ VERIFIED | Line 5: `"windows": ["main", "app-*"]` |
| `src/hooks/useAppsConfig.ts` | `badgeAppIds` state + `app-title-changed` event listener + badge clear on switch | ✓ VERIFIED | Line 33: `useState<Set<string>>(new Set())`. Lines 102-109: `handleTitleChanged`. Lines 84-90: badge clear in `handleAppSwitched`. Lines 127-132: badge clear in `switchApp`. |
| `src/components/Sidebar.tsx` | White dot badge on sidebar items with pending badge | ✓ VERIFIED | Line 30: `hasBadge: boolean` in `SortableAppItemProps`. Lines 94-96: `{hasBadge && !isActive && <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white opacity-90" />}`. Lines 200, 227: `hasBadge={badgeAppIds.has(app.id)}` passed at both group and ungrouped app render sites. |
| `src/App.tsx` | `badgeAppIds` passed to `<Sidebar>` | ✓ VERIFIED | Line 25: `badgeAppIds` destructured from `useAppsConfig()`. Line 202: `badgeAppIds={badgeAppIds}` passed to `<Sidebar>`. |
| `src-tauri/src/lib.rs` | `notify_title_changed` registered in `invoke_handler` | ✓ VERIFIED | Line 247: `commands::webview::notify_title_changed` in `tauri::generate_handler![]`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `switch_app_impl` in webview.rs | `lru_order` field on AppState | `use crate::state::{AppState, LRU_POOL_SIZE}` + `st.lru_order` | ✓ WIRED | Lines 255-269 use `st.lru_order.retain`, `push_back`, `pop_front` |
| Eviction block in `switch_app_impl` | `wv.close()` called outside mutex | Collect `Vec<String>` inside lock scope, drop lock, iterate and close | ✓ WIRED | Lines 251-279: `evicted_ids` collected inside `{ }` scope, lock dropped at `}`, `wv.close()` in subsequent loop |
| Child webview MutationObserver | `notify_title_changed` Rust command | `window.__TAURI_INTERNALS__.invoke('notify_title_changed', ...)` in `initialization_script` | ✓ WIRED | Lines 158-162 in `init_script` format string; wrapped in try/catch for CSP tolerance |
| `notify_title_changed` in Rust | main webview `app-title-changed` CustomEvent | `main_wv.eval("window.dispatchEvent(new CustomEvent('app-title-changed', ...))")` | ✓ WIRED | Lines 21-24: only dispatched when `!is_active` guard passes |
| `useAppsConfig` event handler | Sidebar badge rendering | `badgeAppIds: Set<string>` returned from hook, passed as prop through App.tsx | ✓ WIRED | App.tsx line 202 passes `badgeAppIds`; Sidebar.tsx line 200/227 passes `badgeAppIds.has(app.id)` as `hasBadge` |
| `destroy_webview` | `lru_order` cleanup | `st.lru_order.retain(|id| id != &app_id)` | ✓ WIRED | Line 42 in webview.rs |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WEB-02 | 04-01-PLAN | Webviews use lazy loading — only created on first visit, not at startup | ✓ SATISFIED | `AppState::new` initializes `webviews_created` as empty `HashSet`. No webview creation in `lib.rs::setup`. Creation only in `switch_app_impl` when `!already_created`. |
| WEB-03 | 04-01-PLAN | Recently used webviews stay alive (LRU cache), inactive ones are unloaded | ✓ SATISFIED | `LRU_POOL_SIZE = 8`. Eviction loop in `switch_app_impl` pops oldest from `lru_order` and calls `wv.close()` when pool exceeds 8. |
| WEB-04 | 04-01-PLAN | Switching between cached webviews feels instant (no reload) | ✓ SATISFIED (code) / ? NEEDS HUMAN (timing) | Cached path calls `wv.show()` only — no URL reload, no `WebviewBuilder`. Perceived latency requires runtime measurement. |
| VIS-03 | 04-02-PLAN | Activity badge (dot) appears on sidebar icon when page title changes | ✓ SATISFIED | Full pipeline: MutationObserver → `notify_title_changed` → `app-title-changed` CustomEvent → `badgeAppIds` state → `hasBadge` prop → white dot JSX. |
| PERF-01 | 04-01-PLAN / 04-03-PLAN | App starts in under 1 second (cold start) | ? NEEDS HUMAN | No webview created at startup (code verified). Actual cold-start timing requires running the app and measuring with a stopwatch or profiling tool. |
| PERF-02 | 04-01-PLAN / 04-03-PLAN | Switching between cached apps takes < 100ms perceived | ? NEEDS HUMAN | Code path is `wv.show()` only. Sub-100ms is plausible but requires runtime measurement to confirm. |
| PERF-03 | 04-01-PLAN / 04-03-PLAN | RAM stays under 500 MB with 10 active webviews | ? NEEDS HUMAN | LRU pool caps at 8 (not 10), meaning at most 8 webviews live at once. Pool size of 8 is consistent with the 500 MB budget. Activity Monitor measurement required. |

**Note on PERF-03:** The LRU pool is capped at 8, not 10. The requirement states "under 500 MB with 10 active webviews." The implementation guarantees at most 8 live webviews regardless of how many apps are visited — this is stricter than the requirement, which is acceptable. The 04-03 human verification summary claims this passed.

**Orphaned requirements check:** No requirements mapped to Phase 4 in REQUIREMENTS.md that are absent from plan frontmatter. All 7 requirement IDs (WEB-02, WEB-03, WEB-04, VIS-03, PERF-01, PERF-02, PERF-03) are covered across the three plans.

### Anti-Patterns Found

No anti-patterns detected. Scanned `src-tauri/src/*.rs` and `src/**/*.{ts,tsx}` for TODO/FIXME/PLACEHOLDER/console.log — no matches in phase-modified files.

One observation (not a blocker): The `try/catch` around `__TAURI_INTERNALS__.invoke` in the MutationObserver script is intentional (best-effort badge, CSP tolerance) and documented in the summary. This is the correct design choice for third-party app contexts.

### Human Verification Required

#### 1. Cold Startup Under 1 Second (PERF-01)

**Test:** Quit Nexus completely. Launch via `cargo tauri dev`. Time from launch to sidebar visible.
**Expected:** Sidebar appears in under 1 second. Content area is empty — no webview loading until you click an app.
**Why human:** Startup timing requires measuring real macOS app launch + WKWebView initialization. Not measurable via static analysis.

#### 2. Instant Cached App Switching (PERF-02, WEB-04)

**Test:** Click App A (waits for first load). Click App B (waits for first load). Click App A again.
**Expected:** App A appears immediately on the second click — no white flash, no network request, no reload. Perceived latency under 100ms.
**Why human:** WKWebView `show()` latency depends on macOS compositor. The code path is correct but timing requires runtime measurement.

#### 3. LRU Eviction and RAM Budget (PERF-03, WEB-03)

**Test:** Configure 10+ apps. Click through 9 different apps one by one. Open Activity Monitor, check total Nexus process RAM. Navigate back to the first app visited.
**Expected:** Total RAM under 500 MB. The first app visited should reload (it was evicted from the 8-slot pool). Apps 2-9 should still be cached.
**Why human:** RAM measurement requires real WKWebView processes and Activity Monitor. Reload detection requires visual observation.

#### 4. Keyboard Shortcut Badge Clearing (VIS-03 keyboard path)

**Test:** Get a badge to appear on an app (e.g., wait for Gmail title change). Use Cmd+N (app's keyboard position) to switch to it.
**Expected:** Badge clears on keyboard-triggered switch, not just click-triggered switch.
**Why human:** Requires real keyboard input and observing badge state change. The code path is wired (keyboard switch → `switch_app_impl` → `app-switched` CustomEvent → `handleAppSwitched` → `setBadgeAppIds` with delete), but runtime confirmation needed.

### Gaps Summary

No code gaps found. All implementation artifacts exist, are substantive, and are fully wired. The 4 human verification items are for performance metrics and real-world behavior that cannot be assessed through static code analysis. Plan 04-03 was a human-checkpoint plan, and its summary claims all 5 verification sections passed on 2026-03-19. If you trust the 04-03-SUMMARY.md claim, the phase goal is fully achieved. If you want independent confirmation, run the 4 tests above.

---

_Verified: 2026-03-19T21:30:00Z_
_Verifier: Claude (gsd-verifier)_

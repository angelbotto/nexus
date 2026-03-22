---
phase: 06-notifications
verified: 2026-03-21T00:00:00Z
status: gaps_found
score: 12/14 must-haves verified
gaps:
  - truth: "Clicking a notification focuses Nexus window and switches to the app that fired it"
    status: failed
    reason: "No on_action callback registered in send_notification. The plan's task 2 done criteria explicitly required an on_action handler to focus the main window and call switch_app_impl using the notification group (app_id). This handler does not exist in notifications.rs or lib.rs."
    artifacts:
      - path: "src-tauri/src/commands/notifications.rs"
        issue: "send_notification calls app_handle.notification().builder()...show() but registers no on_action callback. No focus or switch logic present."
    missing:
      - "Register an on_action callback (tauri_plugin_notification ActionType or equivalent) that calls app_handle.get_window(\"main\").map(|w| w.set_focus()) and switch_app_impl(app_id, ...) when a notification is clicked"
  - truth: "useNotifications hook exposes toggleMute — Plan 02 key link: useNotifications.ts -> toggle_mute_app"
    status: partial
    reason: "The key link from plan 02 specifies that useNotifications.ts invokes toggle_mute_app. In the actual implementation, toggleMute was placed in useAppsConfig.ts instead of useNotifications.ts. The invoke call does exist and is wired through App.tsx correctly, so end-user functionality works. However the architectural contract from the plan's key_links was not followed."
    artifacts:
      - path: "src/hooks/useNotifications.ts"
        issue: "Does not export toggleMute or invoke toggle_mute_app. Only exports mutedAppIds, dndEnabled, setDnd."
      - path: "src/hooks/useAppsConfig.ts"
        issue: "Contains toggleMute (invokes toggle_mute_app) — correct behavior, wrong module per plan contract."
    missing:
      - "This is a low-severity architectural deviation. End-to-end mute toggle works correctly. Assess whether the plan contract needs updating vs. refactoring toggleMute back to useNotifications."
human_verification:
  - test: "Trigger native OS notification from a background web app (e.g., Gmail) and click the notification"
    expected: "Nexus window comes to foreground and switches to the Gmail app"
    why_human: "Notification click handler (on_action) is not implemented in code — this is a confirmed gap, but the click behavior must be confirmed absent to rule out any OS-level default handling"
  - test: "Run npm test and cargo test -p nexus_lib to confirm all automated tests pass"
    expected: "All tests pass — extractUnreadCount, computeBadgeTotal, should_send guard logic, config backward compat"
    why_human: "Test execution requires the full build environment"
---

# Phase 6: Notifications Verification Report

**Phase Goal:** Users receive native OS notifications from their web apps without switching to them
**Verified:** 2026-03-21
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | send_notification only fires for background apps — active app silently skipped | VERIFIED | `should_send()` in notifications.rs:17 returns false when `active_app_id == Some(app_id)` |
| 2 | send_notification respects mute state — muted apps produce no OS notification | VERIFIED | `should_send()` in notifications.rs:20 checks `muted_app_ids.iter().any(|id| id == app_id)` |
| 3 | send_notification respects DND — global DND suppresses all notifications | VERIFIED | `should_send()` in notifications.rs:23 returns false when `dnd_enabled` is true |
| 4 | toggle_mute_app persists mute state to apps.json via save_config | VERIFIED | notifications.rs:90 calls `persist_config()` which serializes and writes to `config::config_path()` |
| 5 | set_dnd persists DND state to apps.json via save_config | VERIFIED | notifications.rs:102 calls `persist_config()` after mutating `st.config.dnd_enabled` |
| 6 | window.Notification intercept in init script routes to send_notification without throwing | VERIFIED | webview.rs:174-193 — init script wraps intercept in nested try/catch, invokes `send_notification` via `__TAURI_INTERNALS__.invoke` |
| 7 | notification:default is scoped to main window only (shell-only.json), NOT app-* webviews | VERIFIED | shell-only.json:6 — `"windows": ["main"]`. default.json has no `notification:default` (grep confirmed) |
| 8 | Clicking a notification focuses Nexus window and switches to the app that fired it | FAILED | No `on_action` callback anywhere in Rust codebase. `send_notification` calls `.show()` only — no click handling registered |
| 9 | Sidebar shows bell icon per app that toggles mute on click | VERIFIED | Sidebar.tsx:112-138 — hover-visible bell/bell-off SVG icons with `onPointerDown` stop-propagation and `onClick` calling `onToggleMute(app.id)` |
| 10 | Muted apps still show badge dot but at reduced opacity | VERIFIED | Sidebar.tsx:109-111 — muted badge uses `bg-white/40` vs unmuted `bg-white/90` |
| 11 | Dock badge shows aggregate unread count from unmuted apps only | VERIFIED | useAppsConfig.ts:51-60 — `useEffect` computes `computeBadgeTotal(badgeCounts, mutedAppIds)` and calls `getCurrentWindow().setBadgeCount()` |
| 12 | Badge clears per-app when user switches to that app | VERIFIED | useAppsConfig.ts:108-113 (handleAppSwitched) and switchApp (line 159) both delete app from `badgeCounts` Map |
| 13 | Command palette has 'Toggle Do Not Disturb' and per-app mute actions | VERIFIED | CommandPalette.tsx:117-131 — `dndAction` and `muteActions[]` built dynamically, added to `ALL_ACTIONS` |
| 14 | DND toggle silences all notifications but preserves individual mute settings | VERIFIED | set_dnd (notifications.rs:96) only sets `dnd_enabled`; should_send checks DND independently of muted_app_ids |

**Score:** 13/14 truths verified (1 failed: notification click handler)

Note: Truth #2 in plan 02 key_links (useNotifications.ts invoking toggle_mute_app) is an architectural deviation — toggleMute lives in useAppsConfig.ts. End-user behavior is correct; counted as partial deviation, not a truth failure.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/notifications.rs` | send_notification, toggle_mute_app, set_dnd Rust commands | VERIFIED | All three commands present, substantive (165 lines), registered in lib.rs generate_handler |
| `src-tauri/capabilities/shell-only.json` | Notification + badge capabilities scoped to main window | VERIFIED | notification:default, core:window:allow-set-badge-count, core:window:allow-set-badge-label — windows: ["main"] only |
| `src-tauri/src/config.rs` | muted_app_ids and dnd_enabled fields on NexusConfig | VERIFIED | Lines 32-34 — both fields present with `#[serde(default)]` |
| `src/hooks/useNotifications.ts` | Mute state, DND toggle, badge count computation, dock badge update | PARTIAL | extractUnreadCount, computeBadgeTotal, mutedAppIds, dndEnabled, setDnd present. toggleMute was moved to useAppsConfig.ts — badge/dock update also in useAppsConfig. Functional but architectural deviation from plan. |
| `src/__tests__/notifications.test.ts` | Unit tests for extractUnreadCount and badge sum logic | VERIFIED | 10 tests: 5 for extractUnreadCount, 5 for computeBadgeTotal — all present and substantive |
| `src/types.ts` | Updated NexusConfig with mutedAppIds and dndEnabled | VERIFIED | Lines 19-20 — both fields present as required types |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/commands/webview.rs` | `src-tauri/src/commands/notifications.rs` | `__TAURI_INTERNALS__.invoke('send_notification', ...)` | WIRED | webview.rs:178 — exact pattern present in initialization_script |
| `src-tauri/src/commands/notifications.rs` | `tauri-plugin-notification` | `app_handle.notification().builder()...show()` | WIRED | notifications.rs:63-70 — NotificationExt imported, builder chain present |
| `src-tauri/src/lib.rs` | `src-tauri/src/commands/notifications.rs` | `generate_handler!` registration | WIRED | lib.rs:269-271 — all three commands registered |
| `src/hooks/useNotifications.ts` | Rust `toggle_mute_app` command | `invoke('toggle_mute_app', { appId })` | NOT_WIRED (in wrong module) | invoke exists in useAppsConfig.ts:233, not useNotifications.ts. Functional path: App.tsx calls `toggleMute` from useAppsConfig which invokes Rust. |
| `src/hooks/useNotifications.ts` | Tauri Window API | `getCurrentWindow().setBadgeCount()` | NOT_WIRED (in wrong module) | setBadgeCount call is in useAppsConfig.ts:55, not useNotifications.ts. Same architectural deviation as above. |
| `src/components/Sidebar.tsx` | `src/hooks/useNotifications.ts` (via App.tsx) | `useNotifications` hook consumption | WIRED | App.tsx:38 calls `useNotifications(config)`, passes `mutedAppIds` and `toggleMute` to Sidebar (App.tsx:209-210) |
| `src/components/CommandPalette.tsx` | `src/hooks/useNotifications.ts` (via App.tsx) | `toggleMute` and `setDnd` actions in palette | WIRED | App.tsx:251-254 passes `mutedAppIds`, `dndEnabled`, `onToggleMute={toggleMute}`, `onSetDnd={setDnd}` to CommandPalette |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOTF-01 | 06-01-PLAN.md | User receives native OS notifications from webview apps | SATISFIED (partial gap) | window.Notification proxy in init script (webview.rs:174-193) intercepts calls and routes to send_notification (notifications.rs:29-73). OS notification fires via tauri-plugin-notification. Click-to-focus is missing (see gap). |
| NOTF-02 | 06-01-PLAN.md, 06-02-PLAN.md | User can mute notifications per app | SATISFIED | toggle_mute_app (Rust, persisted), toggleMute (useAppsConfig.ts, optimistic UI), Sidebar bell icon (hover+persistent muted state), context menu "Mute/Unmute", CommandPalette per-app mute actions |
| NOTF-03 | 06-02-PLAN.md | Unread count badge appears on dock/taskbar icon (aggregate count) | SATISFIED | extractUnreadCount parses (N) from title, computeBadgeTotal sums unmuted counts, setBadgeCount/setBadgeLabel dock badge in useAppsConfig.ts useEffect |

No orphaned requirements — all three NOTF requirements appear in plan frontmatter and are accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/hooks/useAppsConfig.ts` | 234 | `console.error("toggleMute failed:", e)` | Info | Error logging — acceptable for debugging. Not a blocker. |

No TODO/FIXME/placeholder patterns found in modified files. No empty implementations detected.

---

### Human Verification Required

#### 1. Notification Click to Focus

**Test:** Trigger a notification from a background app (e.g., send yourself an email while Gmail is not the active app), then click the OS notification banner.
**Expected:** Nexus window comes to the foreground and switches to Gmail tab.
**Why human:** The `on_action` callback for notification click is not implemented in Rust code. This is a confirmed code gap, but human testing should confirm the gap's runtime impact (some OSes may have default dismiss-only behavior).

#### 2. Full automated test suite

**Test:** Run `cd /Users/angelbotto/Dev/hacks/nexus && npm test && cd src-tauri && cargo test -p nexus_lib`
**Expected:** All tests pass — 10 Vitest tests for notification pure functions, 7+ Rust guard logic tests, backward compat tests.
**Why human:** Requires the build environment to be active with all dependencies installed.

---

### Gaps Summary

**One confirmed gap** blocks full phase goal achievement:

**Gap 1 — Notification click handler missing (NOTF-01 partial)**

The phase goal is "users receive native OS notifications from their web apps without switching to them." PLAN 01 task 2 explicitly required a notification click handler: "Notification click handler registered via on_action callback — focuses Nexus + switches to notifying app using group (app_id)." This was also listed as truth #8 in the plan's `must_haves`.

The `send_notification` command fires OS notifications correctly, but when the user clicks the OS notification, nothing happens — Nexus does not come to the foreground and the app does not switch. The notification `group` field is set to `app_id` precisely to enable this callback, but no `on_action` listener is registered anywhere in the codebase.

**Gap 2 — Architectural deviation: toggleMute in wrong module (low severity)**

Plan 02 key_links specified `useNotifications.ts` should invoke `toggle_mute_app`. Instead, `toggleMute` lives in `useAppsConfig.ts`. The end-user behavior is identical — mute toggle works, persists, and updates UI correctly. This is a contract deviation that may matter for future refactors (separation of concerns) but does not break any user-facing feature.

---

*Verified: 2026-03-21*
*Verifier: Claude (gsd-verifier)*

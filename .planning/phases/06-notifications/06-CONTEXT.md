# Phase 6: Notifications - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users receive native OS notifications from their web apps (Gmail, Slack, Linear, etc.) without switching to them. Per-app mute control, global DND mode, and aggregate unread count badge on the dock/taskbar icon.

</domain>

<decisions>
## Implementation Decisions

### Notification appearance
- Title: App name (e.g., "Gmail"), Body: whatever the web app passed to `new Notification(title, {body})`
- Show app's favicon as notification icon
- Group notifications by app (multiple Gmail notifications stack into one expandable group)
- Only fire for background apps — the active app never double-notifies

### Click behavior
- Clicking a notification focuses Nexus window AND switches to the app that fired it

### Mute controls
- Right-click context menu on sidebar app: "Mute notifications" toggle (primary, v1.0 context menu infra exists)
- Also accessible from command palette: "Mute [app] notifications"
- Also accessible from settings panel (Phase 9 will populate)
- Inline sidebar bell icon toggle for quick visual mute
- New apps default to notifications ON — user mutes the noisy ones
- Global DND toggle available from command palette or sidebar — silences all, preserves individual mute settings

### Dock badge
- Sum of parsed title numbers from unmuted apps: "(3) Gmail" + "(5) Slack" = badge 8
- If title has no number but badge dot is active, count as 1
- Badge clears per-app when user visits that app — dock badge updates to remaining sum
- Only unmuted apps contribute to dock badge count

### Notification filtering
- Simple on/off per app — no per-channel or rate limiting
- Muting stops OS notifications but sidebar badge (dot/number) still shows — user sees activity without being interrupted
- Muted apps don't contribute to dock badge count

### Claude's Discretion
- Notification sound (use OS default or silent)
- How to parse title numbers (regex patterns for different SPA title formats)
- Notification permission request handling (OS-level permission flow)
- How to store mute preferences (in apps.json or separate preferences file)
- DND toggle visual indicator (icon state, sidebar indicator)

</decisions>

<specifics>
## Specific Ideas

- The notification bridge should reuse the existing `initialization_script` injection pattern from v1.0 Phase 4 (MutationObserver for title changes)
- Intercept `window.Notification` constructor in the same init script — proxy to Rust via `__TAURI_INTERNALS__.invoke`
- Research confirmed `tauri-plugin-notification` handles OS delivery; the JS bridge is the custom part
- Notification grouping uses the app_id as the group identifier

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `initialization_script` in webview.rs — already injects MutationObserver, extend to also intercept `window.Notification`
- `notify_title_changed` Rust command — pattern for receiving IPC from child webviews
- `badgeAppIds` in useAppsConfig.ts — badge state tracking, extend for numeric counts
- Context menu infrastructure from Phase 3 — add "Mute notifications" item
- `app-*` capability wildcard in default.json — already covers child webview IPC

### Established Patterns
- Rust→React bridge via `main_wv.eval("window.dispatchEvent(new CustomEvent(...))")`
- `__TAURI_INTERNALS__.invoke` from child webviews with try/catch for CSP resilience
- Config persistence via save_config IPC

### Integration Points
- `initialization_script` in webview.rs is where the `window.Notification` intercept goes
- New `send_notification` Rust command that uses tauri-plugin-notification
- New `set_badge_count` Rust command for dock/taskbar badge
- Mute state needs to flow from config → Rust (to filter before sending) → React (to show inline toggle)

</code_context>

<deferred>
## Deferred Ideas

- Per-channel notification filtering (Slack channels, email labels) — too complex for v2, could be v3
- Notification history panel inside Nexus — separate feature
- Custom notification sounds per app — v3 polish

</deferred>

---

*Phase: 06-notifications*
*Context gathered: 2026-03-21*

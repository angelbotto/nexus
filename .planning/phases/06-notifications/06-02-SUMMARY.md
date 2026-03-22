---
phase: 06-notifications
plan: 02
subsystem: ui
tags: [react, tauri, notifications, badge, sidebar, command-palette, vitest]

requires:
  - phase: 06-01
    provides: toggle_mute_app and set_dnd Rust IPC commands, muted_app_ids/dnd_enabled in NexusConfig

provides:
  - useNotifications hook with extractUnreadCount, computeBadgeTotal, toggleMute, setDnd
  - Sidebar bell/bell-off icon per app with hover/persistent mute indicator
  - Context menu "Mute/Unmute notifications" as first item
  - CommandPalette ">Toggle Do Not Disturb" action with current state shown
  - CommandPalette ">mute [app]" per-app mute toggle actions
  - Dock badge updates via setBadgeCount (setBadgeLabel fallback) from unmuted app counts
  - badgeCounts Map<string, number|null> in useAppsConfig (alongside backward-compat badgeAppIds Set)

affects: [App.tsx, CommandPalette, Sidebar, useAppsConfig]

tech-stack:
  added: []
  patterns:
    - "extractUnreadCount regex (N) prefix pattern for macOS/browser window title parsing"
    - "computeBadgeTotal: null=1 (dot badge), numeric=count, muted apps excluded"
    - "Dock badge: setBadgeCount with setBadgeLabel fallback (macOS bug #13905)"
    - "Inline SVG bell/bell-off icons — no icon library dependency"

key-files:
  created:
    - src/hooks/useNotifications.ts
    - src/__tests__/notifications.test.ts
  modified:
    - src/types.ts
    - src/hooks/useAppsConfig.ts
    - src/components/Sidebar.tsx
    - src/components/CommandPalette.tsx
    - src/App.tsx
    - src/__tests__/configMutations.test.ts

key-decisions:
  - "Badge dot for muted apps uses reduced opacity (white/40) vs unmuted (white/90) — visual distinction without removing indicator"
  - "Bell icon uses role=button span (not nested button) inside a button — avoids invalid HTML nesting while preserving click handler"
  - "Per-app mute actions in CommandPalette are dynamic (computed from apps array), not static constants"
  - "Dock badge update lives in useAppsConfig useEffect watching badgeCounts + config.mutedAppIds"

patterns-established:
  - "useNotifications is stateless re: config — derives Sets from config props, does not own state"
  - "DND toggle and mute toggle both call invoke + reload_config to keep config in sync with Rust state"

requirements-completed: [NOTF-02, NOTF-03]

duration: 7min
completed: 2026-03-22
---

# Phase 06 Plan 02: Notification UI Summary

**React notification UI with sidebar bell-icon mute toggle, CommandPalette DND/mute actions, numeric badge parsing via (N) title prefix, and dock badge aggregate from unmuted apps**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-22T02:32:38Z
- **Completed:** 2026-03-22T02:39:00Z (checkpoint reached)
- **Tasks:** 3 of 3 complete (checkpoint:human-verify approved)
- **Files modified:** 7

## Accomplishments

- `extractUnreadCount` and `computeBadgeTotal` pure functions with 10 Vitest tests
- `useNotifications` hook exposes mutedAppIds, dndEnabled, toggleMute, setDnd via Tauri IPC
- `useAppsConfig` migrated from `badgeAppIds: Set` to `badgeCounts: Map<string, number|null>` with dock badge side-effect
- Sidebar shows hover-visible bell icon and persistent bell-off when muted; muted badge shown at reduced opacity
- Context menu gains "Mute/Unmute notifications" as first menu item
- CommandPalette adds "Toggle Do Not Disturb" (with ON/OFF state) and per-app mute actions under `>` mode

## Task Commits

1. **Task 1: Types + useNotifications hook + unread count logic with tests** - `55d0547` (feat)
2. **Task 2: Sidebar bell icon + context menu mute + command palette DND actions** - `b53874d` (feat)
3. **Task 3: Human verification** — APPROVED (checkpoint:human-verify passed 2026-03-21)

**Post-checkpoint fix commits:**
- `cc23d2d` — fix: bell mute toggle with optimistic UI + loading spinner for webviews
- `a713dbe` — fix(ui): bell icon click blocked by dnd-kit pointer listeners
- `88b2b3c` — fix(ui): position bell icon to far right on hover, not inline with name
- `77a8aca` — fix: add Edit menu for clipboard support (Copy/Paste/Cut/Undo/Redo)

## Files Created/Modified

- `src/hooks/useNotifications.ts` — extractUnreadCount, computeBadgeTotal, useNotifications hook
- `src/__tests__/notifications.test.ts` — 10 unit tests for pure functions
- `src/types.ts` — NexusConfig extended with mutedAppIds and dndEnabled fields
- `src/hooks/useAppsConfig.ts` — badgeCounts Map, dock badge useEffect, title parsing
- `src/components/Sidebar.tsx` — bell/bell-off SVG icons, mute props, context menu item
- `src/components/CommandPalette.tsx` — DND + per-app mute actions in action mode
- `src/App.tsx` — useNotifications wired, new props threaded to Sidebar and CommandPalette
- `src/__tests__/configMutations.test.ts` — makeConfig updated for new required fields

## Decisions Made

- Badge dot for muted apps: reduced opacity (`white/40`) vs unmuted (`white/90`) — shows activity without prominence
- Bell icon implemented as `role="button"` span inside the button element to avoid invalid HTML (no `<button>` inside `<button>`)
- Dock badge fires on both `badgeCounts` and `config.mutedAppIds` changes for instant reactivity

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all tests passed, Rust build clean.

## Checkpoint Verification Results

All 6 verification items confirmed approved by user (2026-03-21):
- Bell icon toggles mute/unmute with optimistic UI (immediate feedback)
- Context menu "Mute notifications" works
- Command palette DND toggle works
- Loading spinner shows while webview pages load
- Dock badge with aggregate unread count
- Native OS notifications from background apps

## Next Phase Readiness

- Phase 06 complete — both plans shipped and human-verified
- Ready to proceed to Phase 07: Polish & Sidebar

---
*Phase: 06-notifications*
*Completed: 2026-03-21*

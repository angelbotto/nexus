---
phase: 07-polish-sidebar
plan: 01
subsystem: ui
tags: [motion, react, animation, sidebar, badge, tauri, rust]

# Dependency graph
requires:
  - phase: 06-notifications
    provides: badgeCounts map and extractUnreadCount parsed from page title
provides:
  - motion/react AnimatePresence wrappers for sidebar and command palette
  - crossfade overlay for app switching
  - numeric badge with scale-bump animation (BadgeCount component)
  - chevron toggle button at sidebar bottom
  - NexusConfig extended with pinnedAppIds and sidebarWidth (Rust + TS)
  - save_sidebar_width Rust command
  - calc_webview_rect accepting dynamic sidebar_width
affects: [07-02-plan, 07-03-plan]

# Tech tracking
tech-stack:
  added: [motion (motion/react)]
  patterns:
    - AnimatePresence wrapping conditional sidebar render with initial={false} to suppress startup animation
    - Crossfade overlay fires Rust switch_app first, then animates — never delays IPC call
    - prefersReducedMotion check at module level sets animation duration to 0 for accessibility
    - useAnimate from motion/react for imperative scale-bump on badge count change
    - serde default functions for new optional config fields (backward compat)

key-files:
  created: []
  modified:
    - src/types.ts
    - src/hooks/useAppsConfig.ts
    - src/App.tsx
    - src/components/Sidebar.tsx
    - src/components/CommandPalette.tsx
    - src-tauri/src/config.rs
    - src-tauri/src/state.rs
    - src-tauri/src/commands/webview.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "motion/react (not framer-motion) — same library, official new package name"
  - "AnimatePresence initial={false} on sidebar to suppress animation on app startup"
  - "Crossfade overlay pattern: call Rust first, THEN set isSwitching true — guarantees no IPC delay"
  - "calc_webview_rect now accepts sidebar_width as explicit param (was hardcoded 220px constant)"
  - "BadgeCount uses useAnimate for imperative scale-bump rather than declarative animate prop"
  - "prefersReducedMotion evaluated at module level (outside component) for stable reference"

patterns-established:
  - "Animation: AnimatePresence with initial={false} for sidebar — suppress startup animation"
  - "Animation: Only opacity and transform used — never width/height — honoring 100ms switch contract"
  - "IPC-first animation: Rust calls always fire before any animation setup"
  - "Badge: null = dot fallback, number = count display, undefined = no badge"

requirements-completed: [PLSH-01, PLSH-02, PLSH-03]

# Metrics
duration: 9min
completed: 2026-03-22
---

# Phase 7 Plan 01: Polish Sidebar — Animations + Badges Summary

**Animated sidebar/palette/app-switch with motion/react, numeric unread badges with scale-bump, extended config schema (pinnedAppIds + sidebarWidth), and save_sidebar_width Rust command**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-22T04:03:00Z
- **Completed:** 2026-03-22T04:12:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Sidebar toggles with slide+fade animation (150ms open / 120ms close) via AnimatePresence
- Command palette opens with scale+fade + backdrop dim (120ms/80ms)
- App switching shows crossfade overlay without delaying the Rust switch_app IPC call
- Badge upgraded from boolean dot to numeric count with scale-bump on change
- Chevron toggle button added at sidebar bottom dispatching sidebar-toggle event
- NexusConfig extended with pinnedAppIds and sidebarWidth (Rust + TS, backward compat via serde defaults)
- save_sidebar_width command registered for Plan 02/03 to call when user drags sidebar

## Task Commits

1. **Task 1: Extend config schema and install motion** - `bb6d14f` (feat)
2. **Task 2: Animations to sidebar, command palette, app switching** - `91ab276` (feat)
3. **Task 3: Numeric unread badge and sidebar toggle button** - `6afb585` (feat)

## Files Created/Modified
- `src/types.ts` - Added pinnedAppIds and sidebarWidth fields to NexusConfig
- `src/hooks/useAppsConfig.ts` - Pass sidebarWidth in resize_active_webview invoke; fix setBadgeCount null->undefined
- `src/App.tsx` - AnimatePresence for sidebar, crossfade overlay, handleSwitchApp wrapper, badgeCounts prop
- `src/components/Sidebar.tsx` - BadgeCount component, chevron toggle button, badgeCounts prop replaces badgeAppIds
- `src/components/CommandPalette.tsx` - AnimatePresence scale+fade with backdrop dim
- `src-tauri/src/config.rs` - pinned_app_ids + sidebar_width with serde defaults
- `src-tauri/src/state.rs` - sidebar_width field initialized from config
- `src-tauri/src/commands/webview.rs` - calc_webview_rect takes sidebar_width, resize_active_webview stores it, save_sidebar_width command
- `src-tauri/src/lib.rs` - save_sidebar_width registered + resize handler uses dynamic sidebar_width

## Decisions Made
- Used `motion/react` not `framer-motion` — same API, official new package name
- `AnimatePresence initial={false}` on sidebar suppresses animation on app startup (first render)
- Crossfade overlay: call `switchApp` Rust IPC first, then set `isSwitching` — no IPC delay
- `calc_webview_rect` now accepts `sidebar_width` as explicit parameter (removed hardcoded 220px)
- `prefersReducedMotion` evaluated at module level outside component for stable, non-reactive reference

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test NexusConfig struct literals missing new fields**
- **Found during:** Task 1 (config schema extension)
- **Issue:** Rust test struct literals for NexusConfig were missing `pinned_app_ids` and `sidebar_width` fields causing compile error
- **Fix:** Added `pinned_app_ids: vec![]` and `sidebar_width: 200.0` to all 3 inline NexusConfig structs in test module
- **Files modified:** src-tauri/src/config.rs
- **Verification:** Rust tests pass (34 tests)
- **Committed in:** bb6d14f (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript makeConfig missing new fields**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** configMutations.test.ts makeConfig helper was missing pinnedAppIds/sidebarWidth causing TS2322
- **Fix:** Added `pinnedAppIds: []` and `sidebarWidth: 200` to makeConfig defaults
- **Files modified:** src/__tests__/configMutations.test.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** bb6d14f (Task 1 commit)

**3. [Rule 1 - Bug] Fixed setBadgeCount null vs undefined type mismatch**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `win.setBadgeCount()` expects `number | undefined` but was called with `number | null`
- **Fix:** Changed `null` to `undefined` in the ternary: `total > 0 ? total : undefined`
- **Files modified:** src/hooks/useAppsConfig.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** bb6d14f (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - missing fields / type bugs in existing code triggered by new fields)
**Impact on plan:** All auto-fixes were direct consequences of the schema additions. No scope creep.

## Issues Encountered
- Task 2 and Task 3 were interdependent: App.tsx passing `badgeCounts` to Sidebar required Sidebar to accept the new prop. Executed Task 3's Sidebar prop/rendering changes as part of Task 2's commit cycle, committed them as separate logical units.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- motion/react installed, animation patterns established
- Config schema ready for Plan 02 (sidebar width drag) and Plan 03 (pinned apps)
- save_sidebar_width command available for Plan 02 to call on drag end
- Sidebar toggle button wired and working

---
*Phase: 07-polish-sidebar*
*Completed: 2026-03-22*

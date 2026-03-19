---
phase: 04-performance-activity
plan: 01
subsystem: performance
tags: [rust, webview, lru, memory-management, tauri]

requires:
  - phase: 02-sidebar-navigation
    provides: switch_app_impl function and webview lifecycle (create/show/hide/close)

provides:
  - LRU webview pool capped at 8 — oldest webviews evicted when limit exceeded
  - AppState.lru_order VecDeque tracking access order (most recent = back)
  - LRU_POOL_SIZE = 8 constant in state module
  - Anti-deadlock pattern: collect evicted IDs inside mutex, close outside mutex

affects: [05-polish-distribution]

tech-stack:
  added: []
  patterns:
    - "LRU eviction with anti-deadlock: collect Vec<evicted_id> inside Mutex lock, drop lock, then call wv.close() outside lock"
    - "VecDeque retain+push_back for O(n) LRU update — acceptable for n=8"

key-files:
  created: []
  modified:
    - src-tauri/src/state.rs
    - src-tauri/src/commands/webview.rs

key-decisions:
  - "LRU pool size = 8: balances RAM budget (8 webviews ~400 MB) against UX (most users have < 8 daily apps)"
  - "Active app is never evicted: explicit guard in eviction loop prevents destroying the app user is viewing"
  - "webviews_created HashSet kept alongside lru_order VecDeque: O(1) existence checks vs O(n) LRU ordering — different purposes"
  - "collect-then-close anti-deadlock pattern: Tauri wv.close() may acquire internal locks — never call while holding AppState mutex"

patterns-established:
  - "Mutex guard scope: drop Mutex as soon as state reads/writes are complete; never hold it across Tauri API calls"
  - "lru_order.retain(|id| id != &app_id) + push_back = move-to-back in O(n)"

requirements-completed: [WEB-02, WEB-03, WEB-04, PERF-01, PERF-02, PERF-03]

duration: 2min
completed: 2026-03-19
---

# Phase 4 Plan 01: LRU Webview Pool Summary

**LRU eviction pool (max 8 webviews) in AppState with anti-deadlock collect-then-close pattern in switch_app_impl**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-19T21:13:01Z
- **Completed:** 2026-03-19T21:14:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- AppState gains `lru_order: VecDeque<String>` and `LRU_POOL_SIZE = 8` constant with no new dependencies (stdlib only)
- switch_app_impl updates LRU order on every switch and evicts webviews beyond the 8-slot pool
- Active app is explicitly guarded from eviction; eviction calls `wv.close()` outside the Mutex lock to prevent deadlock
- destroy_webview command updated to also remove app from `lru_order` for consistency

## Task Commits

1. **Task 1: Add LRU order tracking to AppState** - `15453d2` (feat)
2. **Task 2: Integrate LRU tracking and eviction into switch_app_impl** - `f884c11` (feat)

## Files Created/Modified

- `src-tauri/src/state.rs` - Added VecDeque import, LRU_POOL_SIZE constant, lru_order field and initialization
- `src-tauri/src/commands/webview.rs` - Imported LRU_POOL_SIZE, added LRU update + eviction block in switch_app_impl, updated destroy_webview

## Decisions Made

- LRU pool size set to 8: at ~50 MB/webview typical RAM, 8 webviews = ~400 MB, safely under the 500 MB budget
- The collect-then-close pattern: `wv.close()` is a Tauri API call that may acquire internal locks — holding the AppState Mutex while calling it risks deadlock, so evicted IDs are collected into a `Vec<String>`, the lock is dropped, then webviews are closed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LRU pool is live; RAM is now bounded at ~8 webviews (~400 MB)
- Phase 4 Plan 02 can now implement activity tracking (badge dots, unread counts) on top of the pool management
- No blockers

---
*Phase: 04-performance-activity*
*Completed: 2026-03-19*

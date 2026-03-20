---
phase: 05-cross-platform-distribution
plan: 02
subsystem: ui
tags: [tauri, updater, auto-update, react, tailwind]

# Dependency graph
requires:
  - phase: 05-cross-platform-distribution
    provides: "tauri.conf.json with createUpdaterArtifacts v1Compatible set (Plan 01)"
provides:
  - "tauri-plugin-updater and tauri-plugin-process registered in Rust"
  - "UpdateBanner component with non-blocking update check on launch"
  - "Capabilities granting updater:default and process:allow-restart"
  - "plugins.updater config with GitHub releases endpoint in tauri.conf.json"
affects:
  - "CI/CD build pipeline (signing key must be generated and stored as GitHub Secret)"

# Tech tracking
tech-stack:
  added:
    - tauri-plugin-updater 2.10.0
    - tauri-plugin-process 2.3.1
    - "@tauri-apps/plugin-updater"
    - "@tauri-apps/plugin-process"
  patterns:
    - "Silent update check on mount: useEffect with async IIFE and try/catch, no error surface"
    - "check() called twice: once on mount, once on Restart click (re-validates before download)"
    - "process:allow-restart is the correct permission name (not process:allow-relaunch)"

key-files:
  created:
    - src/components/UpdateBanner.tsx
    - src-tauri/capabilities/desktop.json
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/lib.rs
    - src-tauri/tauri.conf.json
    - src/App.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "process:allow-restart is the correct Tauri v2 capability permission name (not process:allow-relaunch as the plan suggested) — auto-fixed during Task 1 via cargo check error output"
  - "tauri add CLI created desktop.json (platform-specific capability) rather than adding to default.json — kept this separation since updater only applies to desktop targets"
  - "check() called again on Restart to get fresh update object before downloadAndInstall — avoids stale closure holding the update object from initial check"

patterns-established:
  - "Silent update pattern: all errors in try/catch with empty catch block — no user-facing error messages per design"
  - "UpdateBanner renders null when dismissed or no update available — fixed-position overlay, no layout impact"

requirements-completed: [PLAT-02, PLAT-03, PLAT-04]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 05 Plan 02: Auto-Updater Integration Summary

**tauri-plugin-updater integrated with non-blocking launch check, dismissible banner, and one-click restart/relaunch via plugin-process**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T06:28:02Z
- **Completed:** 2026-03-20T06:31:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Both Tauri plugins (updater + process) installed and registered in lib.rs via tauri add CLI
- Desktop capability file created with correct permissions for updater and process
- tauri.conf.json extended with plugins.updater endpoint pointing to GitHub releases
- UpdateBanner component checks for updates on mount, shows dismissible banner, triggers download+relaunch on Restart click — all errors silently swallowed

## Task Commits

Each task was committed atomically:

1. **Task 1: Install updater + process plugins and register in Rust** - `929abf6` (feat)
2. **Task 2: UpdateBanner component and integration in App.tsx** - `7a0ba7e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/components/UpdateBanner.tsx` - Non-blocking update check component with dismissible banner
- `src-tauri/capabilities/desktop.json` - Desktop-only capability with updater:default and process:allow-restart
- `src-tauri/src/lib.rs` - tauri_plugin_updater and tauri_plugin_process registered in Builder chain
- `src-tauri/Cargo.toml` - tauri-plugin-updater (desktop-only target) and tauri-plugin-process added
- `src-tauri/tauri.conf.json` - plugins.updater with pubkey placeholder and GitHub releases endpoint
- `src/App.tsx` - UpdateBanner imported and rendered after DragOverlay

## Decisions Made
- `process:allow-restart` is the correct capability permission name in Tauri v2 (not `process:allow-relaunch` as the plan suggested) — discovered and fixed via cargo check error output
- Kept updater permissions in the new `desktop.json` rather than merging into `default.json` — the CLI created this file and the separation is semantically correct for desktop-only plugins
- `check()` is called twice (once on mount, once on Restart) to get a fresh update object — avoids potential stale closure issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected permission name from process:allow-relaunch to process:allow-restart**
- **Found during:** Task 1 (Install updater + process plugins)
- **Issue:** Plan specified `process:allow-relaunch` but Tauri v2 only knows `process:allow-restart`; cargo check failed with "Permission not found" error
- **Fix:** Changed permission name in `desktop.json` to `process:allow-restart`
- **Files modified:** src-tauri/capabilities/desktop.json
- **Verification:** cargo check passes cleanly
- **Committed in:** 929abf6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan spec)
**Impact on plan:** Necessary correction — capability grant name differs from plugin-level API name. No scope change.

## Issues Encountered
- `tauri add updater` failed initially because `cargo` was not in the default PATH — resolved by sourcing `~/.zshenv` before running the command.

## User Setup Required
**External services require manual configuration before auto-updates will function.**

Before publishing the first release:
1. Generate the signing key pair: `npm run tauri signer generate -- -w ~/.tauri/nexus.key`
2. Store the generated public key in `tauri.conf.json` under `plugins.updater.pubkey` (replace `REPLACE_WITH_PUBLIC_KEY`)
3. Store `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub repository secrets for the CI workflow

In dev mode, the banner will never appear (the update endpoint is unreachable and errors are silently swallowed).

## Next Phase Readiness
- Auto-updater integration is complete; the app is ready for distribution signing setup
- Phase 5 Plan 03 (if any) can proceed — all updater infrastructure is in place
- The only remaining manual step is generating and configuring the signing key pair

---
*Phase: 05-cross-platform-distribution*
*Completed: 2026-03-20*

---
phase: 05-cross-platform-distribution
plan: 03
subsystem: infra
tags: [github-actions, tauri, ci-cd, release, updater, cross-platform]

# Dependency graph
requires:
  - phase: 05-01
    provides: Release profile with LTO+strip optimizations targeting < 15 MB artifacts
  - phase: 05-02
    provides: tauri-plugin-updater integration that consumes latest.json from releases
provides:
  - Tag-triggered GitHub Actions workflow building macOS universal binary, Ubuntu .deb/.AppImage, Windows NSIS installer
  - Draft GitHub Release created automatically with all platform artifacts
  - latest.json updater manifest uploaded to each release for auto-update
  - Post-build artifact size gate that fails CI if any artifact exceeds 15 MB
affects:
  - release-workflow
  - auto-updater

# Tech tracking
tech-stack:
  added: [tauri-apps/tauri-action@v1, actions/checkout@v4, actions/setup-node@v4, dtolnay/rust-toolchain, swatinem/rust-cache@v2]
  patterns: [matrix-strategy-cross-platform, fail-fast-false, draft-release-manual-publish, size-gate-ci-enforcement]

key-files:
  created:
    - .github/workflows/publish.yml
  modified: []

key-decisions:
  - "fail-fast: false so one platform failing does not cancel other platform builds"
  - "npm ci instead of npm install for reproducible installs in CI"
  - "Tests run before build step to catch issues early without wasting build time"
  - "releaseDraft: true — user reviews and manually publishes release"
  - "uploadUpdaterJson: true generates latest.json manifest consumed by tauri-plugin-updater"
  - "Post-build size gate uses stat -f%z (macOS) with fallback to stat -c%s (Linux/Windows) for cross-platform bash compatibility"

patterns-established:
  - "Artifact size gate: scan src-tauri/target/release/bundle/**/* with MAX_BYTES=15728640, exit 1 on any overage"
  - "Universal macOS: dtolnay/rust-toolchain targets aarch64-apple-darwin,x86_64-apple-darwin + --target universal-apple-darwin arg"

requirements-completed: [PLAT-02, PLAT-03, PLAT-04, PERF-04]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 5 Plan 03: CI/CD Publish Workflow Summary

**Tag-triggered GitHub Actions workflow building macOS universal binary, Ubuntu .deb/.AppImage, and Windows .exe with draft release creation, latest.json upload for auto-updater, and 15 MB artifact size gate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T06:33:38Z
- **Completed:** 2026-03-20T06:36:38Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `.github/workflows/publish.yml` with 3-platform matrix (macOS universal, Ubuntu 22.04, Windows latest)
- Configured tag-triggered (`v*`) CI that creates a draft GitHub Release via tauri-apps/tauri-action
- Enabled `uploadUpdaterJson: true` to produce the `latest.json` manifest consumed by tauri-plugin-updater (from Plan 05-02)
- Added post-build artifact size gate enforcing PERF-04: any artifact > 15 MB fails the job with an explicit error

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions publish workflow with artifact size gate** - `e522811` (feat)

**Plan metadata:** (pending — docs commit)

## Files Created/Modified
- `.github/workflows/publish.yml` - Tag-triggered multi-platform CI/CD pipeline with artifact size gate

## Decisions Made
- `fail-fast: false` — ensures macOS/Ubuntu/Windows builds run independently; one failure does not cancel the others
- `releaseDraft: true` — user manually reviews and publishes; avoids accidental public release
- `uploadUpdaterJson: true` — generates `latest.json` for tauri-plugin-updater endpoints configured in tauri.conf.json
- Artifact size check uses `stat -f%z` (macOS) with `stat -c%s` (Linux/Windows) fallback for cross-platform bash compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration before the workflow will succeed:**

1. **Generate signing key locally:**
   ```
   npm run tauri signer generate -- -w ~/.tauri/nexus.key
   ```

2. **Add GitHub Secrets** (repo Settings > Secrets and Variables > Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — content of `~/.tauri/nexus.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password chosen during key generation

3. **Update public key in tauri.conf.json:**
   - Copy content of `~/.tauri/nexus.key.pub`
   - Replace `REPLACE_WITH_PUBLIC_KEY` in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`

4. **Trigger the workflow:**
   ```
   git tag v0.1.0 && git push --tags
   ```

## Next Phase Readiness

- CI/CD pipeline is complete — all three phases of Plan 05 are now done
- Phase 5 (Cross-Platform Distribution) is complete pending the user setup steps above
- After setup: `git tag v0.1.0 && git push --tags` will produce all platform installers and a draft GitHub Release

---
*Phase: 05-cross-platform-distribution*
*Completed: 2026-03-20*

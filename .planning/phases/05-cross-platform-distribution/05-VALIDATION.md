---
phase: 5
slug: cross-platform-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (frontend) + cargo test (Rust) |
| **Config file** | `vite.config.ts` / `Cargo.toml` |
| **Quick run command** | `cargo test --manifest-path src-tauri/Cargo.toml` |
| **Full suite command** | `npm test && cargo test --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test --manifest-path src-tauri/Cargo.toml`
- **After every plan wave:** Run `npm test && cargo test --manifest-path src-tauri/Cargo.toml`
- **Before `/gsd:verify-work`:** Full CI matrix passes (all 3 platforms build, artifact sizes confirmed)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PLAT-02,03,04 | smoke | `cargo check` + CI green | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | PLAT-02,03,04 | smoke | `cargo check` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | PLAT-02,03,04 | CI | CI matrix green | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | PERF-04 | CI | artifact size check | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | PLAT-02,03,04,PERF-04 | manual | human verify | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/publish.yml` — CI workflow for all 3 platforms
- [ ] `src-tauri/Cargo.toml` `[profile.release]` block — size optimization
- [ ] CI step to assert artifact size < 15 MB for PERF-04
- [ ] `tauri.conf.json` `createUpdaterArtifacts: true` + `plugins.updater` config

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS universal binary runs on arm64+intel | PLAT-02 | Requires real macOS hardware | Build universal, run on Mac |
| Linux .deb/.AppImage on Ubuntu 22.04 | PLAT-03 | Requires Linux environment | Install in VM, launch app |
| Windows NSIS installer on Win 10/11 | PLAT-04 | Requires Windows environment | Install in VM, test shortcuts/sessions |
| Binary size < 15MB all platforms | PERF-04 | CI check + manual verify | Check artifact sizes in release |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend unit) + `cargo test` (Rust unit) |
| **Config file** | `vite.config.ts` (inline test block) — Wave 0 gap |
| **Quick run command** | `cargo test -p nexus && pnpm vitest run --reporter=dot` |
| **Full suite command** | `cargo test -p nexus && pnpm vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p nexus && pnpm vitest run --reporter=dot`
- **After every plan wave:** Run `cargo test -p nexus && pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | CONF-01 | unit (Rust) | `cargo test -p nexus -- config` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CONF-01 | unit (Rust) | `cargo test -p nexus -- config::first_run` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CONF-01 | unit (Rust) | `cargo test -p nexus -- config::serde` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | CONF-04 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | WEB-01 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | WEB-05 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | WEB-06 | manual-only | — | N/A | ⬜ pending |
| TBD | 03 | 2 | WEB-07 | unit (Rust) | `cargo test -p nexus -- routing::oauth` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | WEB-07 | unit (Rust) | `cargo test -p nexus -- routing::domain` | ❌ W0 | ⬜ pending |
| TBD | 04 | 3 | PLAT-01 | smoke | `cargo build --target aarch64-apple-darwin` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/config.rs` with `#[cfg(test)]` module — covers CONF-01 serde + first-run
- [ ] `src-tauri/src/routing.rs` with `#[cfg(test)]` module — covers WEB-07 domain/OAuth heuristics
- [ ] `vitest.config.ts` or `vite.config.ts` test block — frontend test infrastructure
- [ ] `src/__tests__/` directory — colocated test files per global CLAUDE.md convention

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File watcher triggers sidebar update | CONF-04 | Requires live FS + Tauri runtime | 1. Launch app 2. Edit apps.json externally 3. Verify sidebar updates within 1s |
| Webview loads correct URL | WEB-01 | Requires Tauri webview runtime | 1. Click app in sidebar 2. Verify URL loads in webview |
| Session persists across restart | WEB-05 | Requires browser session + app restart | 1. Login to Gmail in webview 2. Quit + relaunch Nexus 3. Verify still logged in |
| Sessions isolated between apps | WEB-06 | Requires two webviews with different sessions | 1. Login to Gmail 2. Open different app 3. Verify Gmail cookies not present |
| External links open in system browser | WEB-07 | Requires system browser interaction | 1. Click external link in webview 2. Verify system browser opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

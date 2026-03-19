---
phase: 2
slug: sidebar-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + Rust `#[cfg(test)]` (backend) |
| **Config file** | `vite.config.ts` inline `test:{}` block — Wave 0 gap |
| **Quick run command** | `cargo test -p nexus && pnpm vitest run --reporter=dot` |
| **Full suite command** | `cargo test -p nexus && pnpm vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p nexus && pnpm vitest run --reporter=dot`
- **After every plan wave:** Run `cargo test -p nexus && pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | NAV-01 | unit (React) | `pnpm vitest run src/__tests__/Sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | NAV-03 | unit (TS) | `pnpm vitest run src/__tests__/groupApps.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | NAV-05 | unit (React) | `pnpm vitest run src/__tests__/Sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | NAV-02 | unit (Rust) | `cargo test -p nexus -- config::save` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | NAV-03 | unit (Rust) | `cargo test -p nexus -- config::group_collapsed_default` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | KEY-01 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | KEY-02 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | KEY-03 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | WEB-08 | manual-only | — | N/A | ⬜ pending |
| TBD | 03 | 2 | VIS-01 | manual-only | — | N/A | ⬜ pending |
| TBD | 03 | 2 | VIS-02 | manual-only | — | N/A | ⬜ pending |
| TBD | 03 | 2 | VIS-04 | unit (React) | `pnpm vitest run src/__tests__/App.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/Sidebar.test.tsx` — covers NAV-01, NAV-05 rendering
- [ ] `src/__tests__/groupApps.test.ts` — covers NAV-03 grouping logic
- [ ] `src/__tests__/App.test.tsx` — covers VIS-04 sidebar collapsed layout
- [ ] `vitest.config.ts` or `vite.config.ts` `test:{}` block — frontend test runner setup
- [ ] Rust: `#[cfg(test)]` in config.rs for GroupConfig.collapsed serde default
- [ ] Rust: `#[cfg(test)]` in commands/config.rs for save_config round-trip

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cmd+1 jumps to first app | KEY-01 | Requires Tauri runtime + global shortcut | 1. Launch app 2. Press Cmd+1 3. Verify first app activates |
| Cmd+R reloads active webview | KEY-02, WEB-08 | Requires live webview | 1. Open an app 2. Press Cmd+R 3. Verify page reloads |
| Cmd+B toggles sidebar | KEY-03 | Requires Tauri runtime | 1. Press Cmd+B 2. Verify sidebar disappears 3. Press again 4. Verify restored |
| Dark mode aesthetic | VIS-01 | Visual inspection | 1. Launch app 2. Verify sidebar is near-black, webview is rounded card |
| Thin sidebar with icons | VIS-02 | Visual inspection | 1. Verify sidebar shows favicons + short labels, narrow width |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 3
slug: command-palette-config-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + Rust `#[cfg(test)]` (backend) |
| **Config file** | `vite.config.ts` — Wave 0 gap |
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
| TBD | 01 | 1 | CMD-01 | manual-only | — | N/A | ⬜ pending |
| TBD | 01 | 1 | CMD-02 | unit (TS) | `pnpm vitest run src/__tests__/fuzzySearch.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | CMD-03 | unit (TS) | `pnpm vitest run src/__tests__/useAppsConfig.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | CMD-04 | unit (TS) | same | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | CONF-02 | manual-only | — | N/A | ⬜ pending |
| TBD | 02 | 2 | CONF-03 | manual-only | — | N/A | ⬜ pending |
| TBD | 03 | 3 | CONF-05 | unit (TS) | same | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | NAV-06 | manual-only | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/fuzzySearch.test.ts` — CMD-02 search behavior
- [ ] `src/__tests__/useAppsConfig.test.ts` — CMD-03/04, CONF-05, NAV-06 mutations
- [ ] `vite.config.ts` test block — Vitest runner
- [ ] Rust `#[cfg(test)]` in commands/webview.rs for destroy_webview

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cmd+K opens palette overlay | CMD-01 | Requires runtime | 1. Press Cmd+K 2. Palette appears |
| Add app from palette | CONF-02 | Requires UI interaction | 1. Cmd+K > Add 2. Fill URL+name 3. Verify sidebar |
| Remove from context menu | CONF-03 | Requires native menu | 1. Right-click app 2. Remove 3. Verify gone |
| Drag reorder persists | NAV-06 | Requires drag interaction | 1. Drag app 2. Verify order 3. Restart verify |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

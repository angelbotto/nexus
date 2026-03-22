---
phase: 7
slug: polish-sidebar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PLSH-01 | manual | visual QA | N/A | ⬜ pending |
| 07-01-02 | 01 | 1 | PLSH-02 | unit | `npm test` | ✅ exists | ⬜ pending |
| 07-02-01 | 02 | 2 | SIDE-01,02 | unit+manual | `npm test` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | PLSH-03,SIDE-03 | unit+manual | `npm test` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | all | manual | human verify | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/sidebarResize.test.ts` — snap threshold logic (<80px → iconOnly, >80px → fullMode), clamp [120,300]
- [ ] `src/__tests__/configMutations.test.ts` — add pinApp/unpinApp mutation tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar slide+fade animation | PLSH-01 | Visual QA only | Toggle sidebar, observe animation timing |
| Palette scale+fade animation | PLSH-01 | Visual QA only | Open/close Cmd+K, observe animation |
| App switch crossfade | PLSH-01 | Visual QA only | Switch apps, observe crossfade |
| Toggle button at sidebar bottom | PLSH-03 | Visual QA only | Verify chevron button exists and works |
| Icon-only mode renders correctly | SIDE-02 | Visual QA only | Resize sidebar below 80px, verify icons-only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

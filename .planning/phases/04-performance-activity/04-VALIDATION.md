---
phase: 4
slug: performance-activity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vite.config.ts` (empty `test: {}` block) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual perf check
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | WEB-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | WEB-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | WEB-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | VIS-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | VIS-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | PERF-01 | manual | `cargo tauri dev` + observe | manual-only | ⬜ pending |
| 04-03-02 | 03 | 2 | PERF-02 | manual | measure via console.time | manual-only | ⬜ pending |
| 04-03-03 | 03 | 2 | PERF-03 | manual | Activity Monitor | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lruState.test.ts` — stubs for WEB-02, WEB-03 (LRU eviction logic extracted to pure function)
- [ ] `src/__tests__/badgeState.test.ts` — stubs for VIS-03 (badge set/clear in useAppsConfig logic)
- [ ] Consider extracting LRU eviction to a pure Rust function testable via `cargo test`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App cold-starts in under 1 second | PERF-01 | Requires running macOS app with real WKWebView | `cargo tauri dev`, time from click to visible app |
| Switching cached apps < 100ms | PERF-02 | Requires real WKWebView show/hide timing | `console.time` around switch, observe perceived latency |
| RAM < 500MB with 10 webviews | PERF-03 | Requires real WKWebView processes | Visit 10 apps, check Activity Monitor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 6
slug: notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + cargo test (Rust) |
| **Config file** | `vite.config.ts` / `Cargo.toml` |
| **Quick run command** | `npm test && cargo test -p nexus_lib` |
| **Full suite command** | `npm test && cargo test -p nexus_lib` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test && cargo test -p nexus_lib`
- **After every plan wave:** Run `npm test && cargo test -p nexus_lib`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | NOTF-01 | unit (Rust) | `cargo test -p nexus_lib` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | NOTF-02 | unit (Rust) | `cargo test -p nexus_lib` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | NOTF-02 | unit (TS) | `npm test` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | NOTF-03 | unit (TS) | `npm test` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | NOTF-01,02,03 | manual | human verify | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/notifications.test.ts` — extractUnreadCount, badge sum, mute filtering
- [ ] `src-tauri/src/commands/notifications.rs` — #[cfg(test)] for active/muted/DND guards
- [ ] `src-tauri/src/config.rs` test additions — backward compat with new fields

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OS notification fires for background app | NOTF-01 | Requires real OS notification system | Run app, switch to app B, trigger notification in app A |
| Clicking notification focuses + switches | NOTF-01 | Requires OS notification click handler | Click notification, verify Nexus focuses and switches |
| Dock badge shows aggregate count | NOTF-03 | Requires real dock/taskbar | Check dock icon after multiple apps have unread |
| DND silences all notifications | NOTF-02 | Requires real OS notifications | Enable DND, verify no notifications fire |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

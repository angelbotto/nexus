# Requirements: Nexus

**Defined:** 2026-03-20
**Core Value:** Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.

## v2.0 Requirements

Requirements for v2.0 Power Features milestone. Each maps to roadmap phases.

### Spaces

- [ ] **SPAC-01**: User can create multiple spaces (e.g., "Work", "Personal", "Side Project")
- [ ] **SPAC-02**: User can switch between spaces — sidebar shows only that space's apps
- [ ] **SPAC-03**: Each space remembers its own app order, groups, and layout
- [ ] **SPAC-04**: User can switch spaces via keyboard shortcut (Cmd+Shift+1/2/3)
- [ ] **SPAC-05**: User can open a space in an independent window (detached from main window)
- [ ] **SPAC-06**: Multiple space windows can run simultaneously with independent app states

### Multi-Account

- [ ] **MULT-01**: User can add multiple instances of the same app with different sessions (e.g., Gmail Personal + Gmail Work)
- [ ] **MULT-02**: Each instance has its own isolated cookies/login state
- [ ] **MULT-03**: User can name each instance to distinguish them in sidebar

### Split View

- [ ] **SPLT-01**: User can view two apps side by side in the same window
- [ ] **SPLT-02**: User can resize the split divider to adjust proportions
- [ ] **SPLT-03**: User can enter/exit split view via keyboard shortcut or command palette

### Notifications

- [x] **NOTF-01**: User receives native OS notifications from webview apps (Gmail, Slack, etc.)
- [x] **NOTF-02**: User can mute notifications per app
- [ ] **NOTF-03**: Unread count badge appears on dock/taskbar icon (aggregate count)

### Polish & Animations

- [ ] **PLSH-01**: Smooth animations for sidebar toggle, command palette open/close, and app switching transitions
- [ ] **PLSH-02**: Sidebar badge shows unread count number (not just a dot) — parsed from page title
- [ ] **PLSH-03**: Sidebar toggle button visible in the sidebar (Arc-style, bottom of sidebar)

### Sidebar & Navigation

- [ ] **SIDE-01**: User can resize sidebar width by dragging the edge
- [ ] **SIDE-02**: Sidebar collapses to icon-only mode at narrow widths (no labels, just favicons)
- [ ] **SIDE-03**: User can pin favorite apps to a "Favs" section at the top of the sidebar (always visible across spaces, Arc-style)

### Preferences & Customization

- [ ] **PREF-01**: In-app settings panel accessible from sidebar or command palette
- [ ] **PREF-02**: User can customize app appearance: border-radius, background color, gap between webview and sidebar
- [ ] **PREF-03**: User can customize sidebar colors and theme
- [ ] **PREF-04**: User can customize groups (rename, reorder, color-code)
- [ ] **PREF-05**: User can set a custom icon/favicon for any app (override auto-detected favicon)
- [ ] **PREF-06**: User can customize space icon and color

### Code Signing

- [ ] **SIGN-01**: macOS app is signed and notarized — no Gatekeeper warnings on install
- [ ] **SIGN-02**: Windows app is signed — no SmartScreen warnings on install

## v3 Requirements

Deferred to future release.

### Advanced

- **ADV-01**: Light mode / theme system beyond color customization
- **ADV-02**: Tab management within a single app (browser-like tabs per webview)
- **ADV-03**: Keyboard shortcut customization (remap any shortcut)

## Out of Scope

| Feature | Reason |
|---------|--------|
| OAuth/account system | No login, purely local config |
| App store/marketplace | JSON config is the interface |
| Browser extension support | Incompatible with Tauri's native webview |
| Mobile platform support | Desktop only |
| Cloud sync | Zero backend; users sync JSON via Dropbox/iCloud/git |
| In-webview navigation for external links | Nexus is for web apps, not general browsing |
| Built-in ad blocker | Use system-level blockers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NOTF-01 | Phase 6 | Complete |
| NOTF-02 | Phase 6 | Complete |
| NOTF-03 | Phase 6 | Pending |
| PLSH-01 | Phase 7 | Pending |
| PLSH-02 | Phase 7 | Pending |
| PLSH-03 | Phase 7 | Pending |
| SIDE-01 | Phase 7 | Pending |
| SIDE-02 | Phase 7 | Pending |
| SIDE-03 | Phase 7 | Pending |
| SPAC-01 | Phase 8 | Pending |
| SPAC-02 | Phase 8 | Pending |
| SPAC-03 | Phase 8 | Pending |
| SPAC-04 | Phase 8 | Pending |
| SPAC-05 | Phase 8 | Pending |
| SPAC-06 | Phase 8 | Pending |
| PREF-01 | Phase 9 | Pending |
| PREF-02 | Phase 9 | Pending |
| PREF-03 | Phase 9 | Pending |
| PREF-04 | Phase 9 | Pending |
| PREF-05 | Phase 9 | Pending |
| PREF-06 | Phase 9 | Pending |
| MULT-01 | Phase 10 | Pending |
| MULT-02 | Phase 10 | Pending |
| MULT-03 | Phase 10 | Pending |
| SPLT-01 | Phase 11 | Pending |
| SPLT-02 | Phase 11 | Pending |
| SPLT-03 | Phase 11 | Pending |
| SIGN-01 | Phase 12 | Pending |
| SIGN-02 | Phase 12 | Pending |

**Coverage:**
- v2.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 — traceability filled, all 29 requirements mapped to Phases 6-12*

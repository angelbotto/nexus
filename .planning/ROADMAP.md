# Roadmap: Nexus

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-03-20)
- 🚧 **v2.0 Power Features** — Phases 6-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-19
- [x] Phase 2: Sidebar & Navigation (4/4 plans) — completed 2026-03-19
- [x] Phase 3: Command Palette & Config Management (4/4 plans) — completed 2026-03-19
- [x] Phase 4: Performance & Activity (3/3 plans) — completed 2026-03-19
- [x] Phase 5: Cross-Platform Distribution (4/4 plans) — completed 2026-03-20

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v2.0 Power Features (In Progress)

**Milestone Goal:** Nexus evolves from a simple app switcher into a full workspace manager — spaces for context switching, multi-account support, split view for productivity, native notifications, and premium visual polish.

- [x] **Phase 6: Notifications** — Native OS notifications from webview apps with per-app mute control
- [x] **Phase 7: Polish & Sidebar** — Smooth animations, numeric unread count, sidebar resize, SettingsPanel shell (completed 2026-03-22)
- [ ] **Phase 8: Spaces** — Named workspace contexts with independent app sets and compound key migration
- [ ] **Phase 9: Preferences** — In-app settings panel with full appearance customization
- [ ] **Phase 10: Multi-Account** — Multiple isolated sessions for the same app (conditional — validation spike required)
- [ ] **Phase 11: Split View** — Two apps side by side with draggable divider (conditional — validation spike required)
- [ ] **Phase 12: Code Signing** — macOS notarization and Windows signing for clean install experience

## Phase Details

### Phase 6: Notifications
**Goal**: Users receive native OS notifications from their web apps without switching to them
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: NOTF-01, NOTF-02, NOTF-03
**Success Criteria** (what must be TRUE):
  1. A Gmail or Slack notification fires as a native OS notification while the user is looking at a different app in Nexus
  2. User can mute notifications for a specific app — muted apps produce no OS notifications
  3. Unmuted apps show an aggregate unread count badge on the dock/taskbar icon
  4. Notification only fires for background apps — the active app never double-notifies
  5. The notification bridge never throws or crashes even when a webview loads a page that overrides `window.Notification`
**Plans:** 2/2 plans complete
Plans:
- [x] 06-01-PLAN.md — Rust notification backend: config fields, plugin, send_notification command, init script intercept, capabilities
- [x] 06-02-PLAN.md — Frontend notification UI: useNotifications hook, sidebar bell icon, command palette mute/DND, dock badge

### Phase 7: Polish & Sidebar
**Goal**: Nexus feels refined — smooth transitions, numeric unread counts, a resizable sidebar, and a Settings panel container ready for Preferences
**Depends on**: Phase 6
**Requirements**: PLSH-01, PLSH-02, PLSH-03, SIDE-01, SIDE-02, SIDE-03
**Success Criteria** (what must be TRUE):
  1. Sidebar open/close, command palette open/close, and app switching all animate smoothly without exceeding the 100ms switching performance contract
  2. Sidebar badge shows a numeric unread count (e.g., "3") parsed from the page title prefix, not just a dot
  3. A visible sidebar toggle button (Arc-style, bottom of sidebar) collapses and expands the sidebar
  4. User can drag the sidebar edge to resize it; at narrow widths it collapses to icon-only mode (no labels)
  5. User can pin favorite apps to a "Favs" section at the top of the sidebar that persists across all spaces
  6. A SettingsPanel component shell is present and openable — content is populated in Phase 9
**Plans:** 3/3 plans complete
Plans:
- [x] 07-01-PLAN.md — Config schema + motion install + animations + numeric badge + toggle button
- [x] 07-02-PLAN.md — Sidebar edge-drag resize + icon-only collapse mode
- [x] 07-03-PLAN.md — Favorites section + settings panel shell + visual checkpoint

### Phase 8: Spaces
**Goal**: Users can maintain independent workspace contexts — each Space has its own app set, order, and layout
**Depends on**: Phase 7
**Requirements**: SPAC-01, SPAC-02, SPAC-03, SPAC-04, SPAC-05, SPAC-06
**Success Criteria** (what must be TRUE):
  1. User can create a Space named "Work", switch to it, and see only that Space's apps in the sidebar — Personal Space apps are hidden
  2. Each Space remembers its own app order, groups, and layout independently of other Spaces
  3. User can switch between Spaces using Cmd+Shift+1/2/3 without touching the mouse
  4. User can open a Space in its own independent window — closing that window does not quit the app
  5. Two Space windows can run simultaneously with fully independent app states and sessions (no session bleed between windows)
  6. Webview keys use compound scheme `{space_id}:{app_id}` so LRU pool never evicts the wrong Space's session
**Plans**: TBD

### Phase 9: Preferences
**Goal**: Users can customize Nexus appearance — colors, spacing, radius, themes — through an in-app settings panel
**Depends on**: Phase 8
**Requirements**: PREF-01, PREF-02, PREF-03, PREF-04, PREF-05, PREF-06
**Success Criteria** (what must be TRUE):
  1. Settings panel opens from the sidebar or command palette and persists preferences across restarts
  2. User can change border-radius, background color, and gap between webview and sidebar — changes apply live without restart
  3. User can change sidebar colors and switch between dark/light/system theme
  4. User can rename, reorder, and color-code app groups
  5. User can set a custom icon/favicon for any app that overrides the auto-detected favicon
  6. User can assign a custom icon and color to each Space for visual differentiation
**Plans**: TBD

### Phase 10: Multi-Account
**Goal**: Users can run multiple isolated sessions for the same app in the same Space (e.g., Gmail Personal + Gmail Work)
**Depends on**: Phase 9
**Requirements**: MULT-01, MULT-02, MULT-03
**Success Criteria** (what must be TRUE):
  1. User can add "Gmail Work" and "Gmail Personal" as separate sidebar entries — each loads a completely independent logged-in session
  2. Cookies, login state, and storage are fully isolated between instances — signing out of one does not affect the other
  3. Each instance displays its custom name label in the sidebar to distinguish it from other instances of the same app
**Plans**: TBD

### Phase 11: Split View
**Goal**: Users can view two apps side by side in the same window with an adjustable divider
**Depends on**: Phase 10
**Requirements**: SPLT-01, SPLT-02, SPLT-03
**Success Criteria** (what must be TRUE):
  1. User can enter split view to see two different apps rendered simultaneously side by side
  2. User can drag the divider between the two panes to change their relative widths — minimum pane width is 300px
  3. User can enter and exit split view via keyboard shortcut or command palette without reloading either app
  4. Split view renders correctly after window resize, minimize/restore, and across monitors
**Plans**: TBD

### Phase 12: Code Signing
**Goal**: Nexus installs without security warnings on macOS and Windows
**Depends on**: Phase 11 (or certificates ready, whichever is later)
**Requirements**: SIGN-01, SIGN-02
**Success Criteria** (what must be TRUE):
  1. macOS `.dmg` installs without "unverified developer" Gatekeeper dialog on a clean Mac
  2. Windows installer runs without SmartScreen blocking the install flow
  3. CI/CD pipeline automatically signs and notarizes builds on tagged releases without manual intervention
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-19 |
| 2. Sidebar & Navigation | v1.0 | 4/4 | Complete | 2026-03-19 |
| 3. Command Palette & Config Management | v1.0 | 4/4 | Complete | 2026-03-19 |
| 4. Performance & Activity | v1.0 | 3/3 | Complete | 2026-03-19 |
| 5. Cross-Platform Distribution | v1.0 | 4/4 | Complete | 2026-03-20 |
| 6. Notifications | v2.0 | 2/2 | Complete | 2026-03-21 |
| 7. Polish & Sidebar | v2.0 | 3/3 | Complete | 2026-03-22 |
| 8. Spaces | v2.0 | 0/? | Not started | - |
| 9. Preferences | v2.0 | 0/? | Not started | - |
| 10. Multi-Account | v2.0 | 0/? | Not started | - |
| 11. Split View | v2.0 | 0/? | Not started | - |
| 12. Code Signing | v2.0 | 0/? | Not started | - |

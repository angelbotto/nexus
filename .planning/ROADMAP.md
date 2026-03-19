# Roadmap: Nexus

## Overview

Build a high-performance Tauri 2 desktop app that acts as a unified launcher for web apps. The journey starts by locking in irreversible architectural decisions (webview model, session isolation, IPC boundary), then adds the primary UX surface (sidebar + keyboard shortcuts), then the command palette and in-app config editing, then the performance layer (LRU pool, lazy loading, activity badges), and finally cross-platform distribution. Each phase delivers a coherent, runnable slice.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri scaffold, config layer, session-isolated WebviewWindows, IPC boundary
- [x] **Phase 2: Sidebar & Navigation** - Sidebar UI, app switching, keyboard shortcuts, dark mode (completed 2026-03-19)
- [ ] **Phase 3: Command Palette & Config Management** - Cmd+K palette, add/remove apps in-app, drag-drop reorder
- [ ] **Phase 4: Performance & Activity** - Lazy loading, LRU pool, activity badge dots, perf validation
- [ ] **Phase 5: Cross-Platform Distribution** - macOS intel, Linux, Windows builds and installers

## Phase Details

### Phase 1: Foundation
**Goal**: A working Tauri 2 app with locked-in architecture — file-based config loads and saves, each app gets a session-isolated WebviewWindow, external links open in the system browser, and the IPC boundary between the React shell and Rust core is stable.
**Depends on**: Nothing (first phase)
**Requirements**: CONF-01, CONF-04, WEB-01, WEB-05, WEB-06, WEB-07, PLAT-01
**Success Criteria** (what must be TRUE):
  1. App launches on macOS arm64 and displays a sidebar populated from `~/.nexus/apps.json`
  2. Clicking an app in the sidebar loads its URL in a WebviewWindow with its own isolated session (cookies/login for App A do not appear in App B)
  3. Clicking an external link inside an app webview opens it in the system default browser, not in Nexus
  4. Restarting Nexus restores the previous login state for each app (sessions persist across restarts)
  5. Editing `~/.nexus/apps.json` externally and saving causes the sidebar to update without restarting the app
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — Scaffold Tauri 2 project and build config layer with tests
- [x] 01-02-PLAN.md — WebviewWindow management with session isolation and sidebar UI
- [x] 01-03-PLAN.md — Config file watcher, hot-reload, and full Phase 1 verification

### Phase 2: Sidebar & Navigation
**Goal**: The primary user-facing surface is complete — users can navigate between all their apps using the sidebar or keyboard shortcuts, toggle sidebar visibility, and see which app is active, all with the Arc-inspired dark mode aesthetic.
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, KEY-01, KEY-02, KEY-03, WEB-08, VIS-01, VIS-02, VIS-04
**Success Criteria** (what must be TRUE):
  1. User can click any app in the sidebar to switch to it, with the active app visually highlighted
  2. User can press Cmd+1 through Cmd+9 to jump directly to an app by position (shortcuts fire even when the app webview has keyboard focus)
  3. User can press Cmd+B to collapse the sidebar, and the webview expands to fill the full window; pressing Cmd+B again restores the sidebar
  4. User can press Cmd+R to reload the currently active app webview
  5. Apps are visually grouped in the sidebar under collapsible group labels matching their `group` field in the config
**Plans:** 4/4 plans complete
Plans:
- [x] 02-01-PLAN.md — Extend config schema (Rust + TS) and add save_config command
- [ ] 02-02-PLAN.md — Sidebar UI refactor with groups, Arc dark mode aesthetic
- [ ] 02-03-PLAN.md — Global shortcuts (Cmd+1-9, Cmd+B, Cmd+R) and startup restore
- [ ] 02-04-PLAN.md — Human verification of all Phase 2 success criteria

### Phase 3: Command Palette & Config Management
**Goal**: Users can manage their app list entirely from within Nexus — adding, removing, and reordering apps without editing JSON manually — and can switch to any app instantly via the command palette.
**Depends on**: Phase 2
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CONF-02, CONF-03, CONF-05, NAV-06
**Success Criteria** (what must be TRUE):
  1. User can press Cmd+K to open the command palette overlay and fuzzy-search by app name to switch to any app
  2. User can add a new app (name + URL) from the command palette without touching `apps.json` directly, and the new app immediately appears in the sidebar
  3. User can remove an app from the command palette or sidebar context, and it disappears from both the sidebar and `apps.json`
  4. User can drag and drop an app in the sidebar to reorder it, and the new order is written back to `apps.json` immediately
**Plans**: TBD

### Phase 4: Performance & Activity
**Goal**: Nexus meets its performance contract — sub-1s startup, instant switching between cached apps, and under 500 MB RAM with 10 active webviews — and inactive app icons show a dot badge when the page title changes.
**Depends on**: Phase 3
**Requirements**: WEB-02, WEB-03, WEB-04, VIS-03, PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. App cold-starts in under 1 second (no webviews are created at startup; the first click on an app triggers webview creation)
  2. Switching between two previously visited apps feels instant — no reload, under 100ms perceived latency
  3. With 10 app webviews visited, RAM stays under 500 MB; the LRU pool evicts the least-recently-used webview when the pool is full, and revisiting an evicted app reloads it correctly
  4. When a background app's page title changes (e.g., new message count in Gmail), a dot badge appears on its sidebar icon
**Plans**: TBD

### Phase 5: Cross-Platform Distribution
**Goal**: Nexus ships installable binaries for all target platforms — macOS universal binary, Linux .deb and .AppImage tested on Ubuntu 22.04, Windows 10/11 installer — with a verified small binary size.
**Depends on**: Phase 4
**Requirements**: PLAT-02, PLAT-03, PLAT-04, PERF-04
**Success Criteria** (what must be TRUE):
  1. macOS universal binary (arm64 + intel) builds and runs on both architectures
  2. Linux .deb and .AppImage run on Ubuntu 22.04 and Fedora 39+ without additional dependencies
  3. Windows NSIS installer runs on Windows 10 and 11 and all features (global shortcuts, session persistence, external link handling) work correctly
  4. Final app bundle size is under 15 MB on all platforms
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-03-19 |
| 2. Sidebar & Navigation | 3/4 | Complete    | 2026-03-19 |
| 3. Command Palette & Config Management | 0/TBD | Not started | - |
| 4. Performance & Activity | 0/TBD | Not started | - |
| 5. Cross-Platform Distribution | 0/TBD | Not started | - |

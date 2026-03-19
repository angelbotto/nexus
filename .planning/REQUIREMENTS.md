# Requirements: Nexus

**Defined:** 2025-03-18
**Core Value:** Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Configuration

- [x] **CONF-01**: User can define apps in `~/.nexus/apps.json` with id, name, url, icon, and group fields
- [ ] **CONF-02**: User can add a new app from within the app (UI form or command palette) without editing JSON manually
- [ ] **CONF-03**: User can remove an app from within the app
- [ ] **CONF-04**: App reads and watches `~/.nexus/apps.json` for external changes and reloads automatically
- [ ] **CONF-05**: Drag & drop reorder in sidebar persists new order back to `apps.json`

### Navigation

- [ ] **NAV-01**: User sees a collapsible sidebar on the left with app icons and labels
- [ ] **NAV-02**: User can toggle sidebar visibility with Cmd+B (Ctrl+B on Linux/Windows)
- [ ] **NAV-03**: Apps are visually grouped in sidebar by their `group` field (collapsible sections)
- [ ] **NAV-04**: User can click an app in sidebar to switch to its webview
- [ ] **NAV-05**: Active app is visually highlighted in sidebar
- [ ] **NAV-06**: User can drag and drop apps to reorder them within the sidebar

### Keyboard Shortcuts

- [ ] **KEY-01**: User can press Cmd+1..9 to jump to apps by position
- [ ] **KEY-02**: User can press Cmd+R to reload the active webview
- [ ] **KEY-03**: User can press Cmd+B to toggle sidebar
- [ ] **KEY-04**: User can press Cmd+K to open command palette

### Command Palette

- [ ] **CMD-01**: User can open a command palette overlay with Cmd+K
- [ ] **CMD-02**: User can fuzzy search across all app names to quickly switch
- [ ] **CMD-03**: User can add a new app URL from the command palette
- [ ] **CMD-04**: User can access quick actions (reload, remove app) from command palette

### WebView

- [ ] **WEB-01**: Each app loads its URL in a dedicated webview
- [ ] **WEB-02**: Webviews use lazy loading — only created on first visit, not at startup
- [ ] **WEB-03**: Recently used webviews stay alive (LRU cache), inactive ones are unloaded
- [ ] **WEB-04**: Switching between cached webviews feels instant (no reload)
- [ ] **WEB-05**: Sessions (cookies, login state) persist across app restarts
- [ ] **WEB-06**: Each app has isolated session storage (separate data directory)
- [ ] **WEB-07**: External links (different domain) open in system default browser
- [ ] **WEB-08**: User can reload current webview with Cmd+R

### Visual

- [ ] **VIS-01**: App uses dark mode with minimalist Arc-inspired aesthetic
- [ ] **VIS-02**: Sidebar is thin/narrow with icons and short labels
- [ ] **VIS-03**: Activity badge (dot) appears on sidebar icon when page title changes
- [ ] **VIS-04**: Fullscreen webview area when sidebar is collapsed

### Performance

- [ ] **PERF-01**: App starts in under 1 second (cold start)
- [ ] **PERF-02**: Switching between cached apps takes < 100ms perceived
- [ ] **PERF-03**: RAM stays under 500MB with 10 active webviews
- [ ] **PERF-04**: Binary size is small (under 15MB for the app bundle)

### Platform

- [x] **PLAT-01**: App builds and runs on macOS arm64
- [ ] **PLAT-02**: App builds and runs on macOS intel
- [ ] **PLAT-03**: App builds and runs on Linux (Ubuntu 22.04+)
- [ ] **PLAT-04**: App builds and runs on Windows 10/11

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Spaces

- **SPAC-01**: User can create multiple spaces (sets of apps)
- **SPAC-02**: User can switch between spaces

### Split View

- **SPLT-01**: User can view two apps side by side in the same window

### Notifications

- **NOTF-01**: User receives native OS notifications from app webviews
- **NOTF-02**: User can configure notification preferences per app

### Multi-Account

- **MULT-01**: User can run multiple instances of the same app with separate sessions

### Polish

- **PLSH-01**: Smooth animations for sidebar toggle, app switching, command palette
- **PLSH-02**: Badge shows unread count (number) instead of just a dot

## Out of Scope

| Feature | Reason |
|---------|--------|
| Browser extension support | Incompatible with Tauri's native webview architecture — requires Chromium |
| App marketplace / recipes | Maintenance burden; JSON config with URLs is the interface |
| OAuth / cloud sync | Zero backend architecture; users sync JSON via Dropbox/iCloud/git |
| In-webview navigation for external links | Nexus is for web apps, not general browsing |
| Built-in ad blocker | Use system-level blockers; webview content injection adds complexity |
| Mobile platform support | Desktop only |
| Light mode | v1 is dark mode only; light mode can be added in v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONF-01 | Phase 1 | Done (01-01) |
| CONF-02 | Phase 3 | Pending |
| CONF-03 | Phase 3 | Pending |
| CONF-04 | Phase 1 | Pending |
| CONF-05 | Phase 3 | Pending |
| NAV-01 | Phase 2 | Pending |
| NAV-02 | Phase 2 | Pending |
| NAV-03 | Phase 2 | Pending |
| NAV-04 | Phase 2 | Pending |
| NAV-05 | Phase 2 | Pending |
| NAV-06 | Phase 3 | Pending |
| KEY-01 | Phase 2 | Pending |
| KEY-02 | Phase 2 | Pending |
| KEY-03 | Phase 2 | Pending |
| KEY-04 | Phase 2 | Pending |
| CMD-01 | Phase 3 | Pending |
| CMD-02 | Phase 3 | Pending |
| CMD-03 | Phase 3 | Pending |
| CMD-04 | Phase 3 | Pending |
| WEB-01 | Phase 1 | Pending |
| WEB-02 | Phase 4 | Pending |
| WEB-03 | Phase 4 | Pending |
| WEB-04 | Phase 4 | Pending |
| WEB-05 | Phase 1 | Pending |
| WEB-06 | Phase 1 | Pending |
| WEB-07 | Phase 1 | Pending |
| WEB-08 | Phase 2 | Pending |
| VIS-01 | Phase 2 | Pending |
| VIS-02 | Phase 2 | Pending |
| VIS-03 | Phase 4 | Pending |
| VIS-04 | Phase 2 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 5 | Pending |
| PLAT-01 | Phase 1 | Done (01-01) |
| PLAT-02 | Phase 5 | Pending |
| PLAT-03 | Phase 5 | Pending |
| PLAT-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2025-03-18*
*Last updated: 2026-03-18 after roadmap creation*

# Nexus

## What This Is

A high-performance desktop app that acts as a unified browser for your daily web apps. Built with Tauri 2 — sidebar navigation, persistent sessions, command palette, activity badges, auto-updates. Ships on macOS, Linux, and Windows at ~5MB.

## Core Value

Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.

## Requirements

### Validated

- Collapsible sidebar with icons + labels, app groups, drag & drop reorder — v1.0
- WebView per app with lazy loading, LRU pool (8 max), instant switching — v1.0
- Persistent sessions (cookies/login survive restart) with per-app isolation — v1.0
- JSON config at ~/.nexus/apps.json with hot-reload, add/remove from UI — v1.0
- Keyboard shortcuts: Cmd+1-9, Cmd+B, Cmd+R, Cmd+K — v1.0
- Command Palette with fuzzy search, quick actions, add new app URL — v1.0
- External links open in system default browser — v1.0
- Badge dot on sidebar icon when page title changes — v1.0
- Dark mode, minimalist Arc-inspired aesthetic — v1.0
- Startup < 1s, switching < 100ms, RAM < 500MB with 10 apps, binary ~5MB — v1.0
- Cross-platform: macOS universal, Linux .deb/.AppImage, Windows NSIS — v1.0
- Auto-updates via tauri-plugin-updater with non-blocking launch check — v1.0
- GitHub Actions CI/CD with tag-triggered 3-platform builds — v1.0

### Active

- [ ] Spaces — multiple workspace contexts with independent app sets
- [ ] Multi-account — same app with different sessions (Gmail personal + work)
- [ ] Split view — two apps side by side in the same window
- [ ] Notifications — native OS notifications from webview apps
- [ ] Polish — smooth animations, unread count badge, settings panel, sidebar toggle button
- [ ] Preferences — customizable appearance (border-radius, colors, gap, themes)
- [ ] Code signing — macOS notarization + Windows certificate for clean install UX

### Out of Scope

- OAuth/account system — no login, purely local config
- App store/marketplace — JSON config is the interface
- Browser extension support — incompatible with Tauri's native webview
- Mobile platform support — desktop only
- Cloud sync — zero backend architecture; users sync JSON via Dropbox/iCloud/git

## Context

Shipped v1.0 with 96 commits, ~25K lines across 105 files.
Tech stack: Tauri 2 (Rust) + React 18 + TypeScript + Vite + Tailwind CSS.
Binary: 4.8 MB on macOS. 2.9 MB .deb on Linux.
CI: GitHub Actions matrix (macOS universal, Ubuntu 22.04, Windows).
Auto-updater: tauri-plugin-updater with GitHub Releases endpoint.

## Constraints

- **Tech stack**: Tauri 2 (Rust backend) + React 18 + TypeScript + Vite + Tailwind CSS
- **Performance**: Startup < 1s, app switch < 100ms perceived, RAM < 500MB with 10 active webviews
- **Platforms**: macOS arm64/intel, Linux (Ubuntu/Fedora), Windows 10/11
- **Config**: JSON file at ~/.nexus/apps.json — no database, no cloud sync
- **Dependencies**: Minimal — avoid heavy JS frameworks beyond React

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 over Electron | Native webviews = less RAM, smaller binary | Good — 4.8MB binary, <500MB RAM |
| Lazy loading webviews | Balance switching speed vs RAM | Good — sub-1s startup, instant cached switching |
| JSON config over GUI settings | Power-user target, scriptable, simple | Good — hot-reload + UI editing works well |
| LRU pool of 8 webviews | Cap RAM while keeping recent apps fast | Good — stays under 500MB with 10 apps |
| data_store_identifier on macOS | Per-app session isolation via WKWebView | Good — sessions survive restarts |
| Platform-native title bar | macOS overlay, Windows/Linux native | Good — feels native on each OS |
| Unsigned for v1 | Zero cost, add signing when user base justifies | Acceptable — right-click Open bypass works |
| MutationObserver for badges | Detect SPA title changes in background apps | Good — catches Gmail, Linear, Slack updates |
| tauri-plugin-updater | In-app auto-updates from GitHub Releases | Good — non-blocking, silent fail on error |

## Current Milestone: v2.0 Power Features

**Goal:** Nexus evolves from a simple app switcher to a full workspace manager — spaces for context switching, multi-account support, split view for productivity, native notifications, and premium visual polish.

**Target features:**
- Spaces (independent app sets per workspace context)
- Multi-account (same app, multiple isolated sessions)
- Split view (two apps side by side)
- Native OS notifications from webviews
- Visual polish (animations, unread count, preferences panel)
- Code signing for clean install experience

---
*Last updated: 2026-03-20 after v2.0 milestone start*

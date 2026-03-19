# Nexus

## What This Is

A high-performance desktop app that acts as a unified browser for your favorite web apps. Built with Tauri 2, it provides a minimal Arc-inspired sidebar for navigation, persistent sessions, and a command palette — all while keeping RAM usage low and startup instant. Cross-platform: macOS, Linux, Windows.

## Core Value

Switching between your daily web apps must feel instant and seamless — zero delay, zero friction, zero bloat.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Collapsible sidebar with icons + labels for each app (Cmd+B toggle)
- [ ] App groups in sidebar (e.g., "Mis Productos", "Social", "News")
- [ ] WebView per app — lazy loaded, only active/recent apps keep webview alive
- [ ] Persistent sessions (cookies/login survive app restart)
- [ ] JSON config at ~/.nexus/apps.json — add/remove apps without recompiling
- [ ] Keyboard shortcuts: Cmd+1..9 to jump between apps, Cmd+R to reload active webview
- [ ] Command Palette (Cmd+K) — fuzzy search apps, quick actions, add new URL
- [ ] Drag & drop reorder apps in sidebar (persisted to JSON)
- [ ] External links open in system default browser
- [ ] Badge dot on sidebar icon when page title changes (silent notification)
- [ ] Dark mode, minimalist Arc-inspired aesthetic
- [ ] Startup < 1 second, instant app switching, low RAM footprint, small binary
- [ ] Cross-platform: macOS (arm64 + intel), Linux, Windows

### Out of Scope

- Spaces/profiles (switch between different sets of apps) — v2 feature
- Split view (two apps side by side) — v2 feature
- Smooth animations/transitions — v2 polish
- Native macOS notifications — v1 uses silent badge only
- OAuth/account system — no login, purely local config
- App store/marketplace — JSON config is the interface
- In-webview navigation for external links — always opens system browser
- Mobile platform support — desktop only

## Context

- Tauri 2 provides native webviews per-platform (WebKit on macOS, WebKitGTK on Linux, WebView2 on Windows) — much lighter than Electron's bundled Chromium
- Lazy loading strategy: only visible + N recently used apps keep webview alive, others are unloaded to free RAM
- Arc browser is the primary aesthetic inspiration: thin vertical sidebar, clean grouping, keyboard-first navigation
- Config is file-based (~/.nexus/apps.json) — power-user friendly, scriptable, version-controllable
- Drag & drop reorder writes back to the JSON config file

## Constraints

- **Tech stack**: Tauri 2 (Rust backend) + React 18 + TypeScript + Vite + Tailwind CSS
- **Performance**: Startup < 1s, app switch < 100ms perceived, RAM < 500MB with 10 active webviews
- **Platforms**: macOS arm64/intel, Linux (Ubuntu/Fedora), Windows 10/11
- **Config**: JSON file at ~/.nexus/apps.json — no database, no cloud sync
- **Dependencies**: Minimal — avoid heavy JS frameworks beyond React

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 over Electron | Native webviews = less RAM, smaller binary, better performance | — Pending |
| Lazy loading webviews | Balance between instant switching and RAM usage | — Pending |
| JSON config over GUI settings | Power-user target audience, scriptable, simple to implement | — Pending |
| Core features first, Arc polish in v2 | Ship a solid foundation before adding Spaces/Split/Animations | — Pending |
| Silent badge over native notifications | Simpler v1, less intrusive, notification fatigue avoidance | — Pending |
| External links to system browser | Nexus is for app webviews, not general browsing | — Pending |

---
*Last updated: 2025-03-18 after initialization*

# Nexus

A fast, lightweight web app switcher built with [Tauri 2](https://v2.tauri.app). Think of it as a minimal browser where each tab is a dedicated web app — Gmail, Linear, Slack, GitHub — with instant switching, isolated sessions, and native performance.

## Why Nexus?

Browsers waste resources keeping dozens of tabs open. Nexus gives each web app its own dedicated webview with:

- **Instant switching** — cached apps switch in <100ms, no reload
- **Isolated sessions** — each app has its own cookies/storage, log into multiple accounts
- **Tiny footprint** — ~5MB binary, <500MB RAM with 10 apps open
- **Sub-1s startup** — webviews are lazy-loaded on first click
- **LRU memory management** — keeps 8 most recent apps alive, evicts the rest silently

## Features

### App Management
- Configure apps in `~/.nexus/apps.json` (macOS/Linux) or `%APPDATA%\Nexus\apps.json` (Windows)
- Add/remove apps from the command palette — no JSON editing needed
- Group apps into collapsible sidebar sections
- Drag & drop reorder in sidebar
- Hot reload — edit the config file and Nexus updates instantly

### Navigation
- Collapsible sidebar with app icons and labels
- Command palette (`Cmd+K` / `Ctrl+K`) with fuzzy search
- Keyboard shortcuts `Cmd+1-9` / `Ctrl+1-9` to jump to apps
- `Cmd+B` / `Ctrl+B` to toggle sidebar
- `Cmd+R` / `Ctrl+R` to reload active app

### Smart Behavior
- External links open in your default browser
- OAuth flows (Google, Microsoft, etc.) stay in the webview
- Activity badges — a dot appears on sidebar icons when background apps update their title (e.g., new Gmail messages)
- Badge clears automatically when you visit the app

### Auto-Updates
- Checks for updates on launch (non-blocking)
- Dismissible banner notification when an update is available
- One-click restart to apply updates

## Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/angelbotto/nexus/releases):

| Platform | File |
|----------|------|
| macOS (Apple Silicon + Intel) | `Nexus_x.x.x_universal.dmg` |
| Linux (Debian/Ubuntu) | `Nexus_x.x.x_amd64.deb` |
| Linux (AppImage) | `Nexus_x.x.x_amd64.AppImage` |
| Windows | `Nexus_x.x.x_x64-setup.exe` |

### macOS Note
Nexus is not signed for v1. On first launch, right-click the app and select **Open** to bypass Gatekeeper.

### Windows Note
SmartScreen may show a warning. Click **More info** → **Run anyway**.

## Getting Started

1. Launch Nexus
2. It creates a default config with example apps (Gmail, Linear, GitHub, Plane)
3. Click any app in the sidebar to load it
4. Use `Cmd+K` / `Ctrl+K` to open the command palette and add your own apps

### Config File

```json
{
  "apps": [
    {
      "id": "gmail",
      "name": "Gmail",
      "url": "https://mail.google.com",
      "group": "comms"
    },
    {
      "id": "linear",
      "name": "Linear",
      "url": "https://linear.app",
      "group": "tools"
    }
  ],
  "groups": [
    { "id": "comms", "name": "Communication" },
    { "id": "tools", "name": "Tools" }
  ]
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + R` | Reload active app |
| `Cmd/Ctrl + 1-9` | Switch to app by position |

## Development

### Prerequisites

- [Node.js](https://nodejs.org) (LTS)
- [Rust](https://rustup.rs)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Platform-specific dependencies

**macOS:** Xcode Command Line Tools
```bash
xcode-select --install
```

**Ubuntu/Debian:**
```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

**Windows:** [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)

### Run in development

```bash
npm install
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

The binary will be in `src-tauri/target/release/`.

### Run tests

```bash
npm test                                          # Frontend (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Backend (Rust)
```

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Vite
- **Backend:** Rust + Tauri 2
- **UI Libraries:** Fuse.js (fuzzy search), dnd-kit (drag & drop)
- **Platforms:** macOS (universal), Linux (deb/AppImage), Windows (NSIS)

## Architecture

```
src/                        # React frontend
  components/
    Sidebar.tsx             # App list with groups, badges, drag & drop
    CommandPalette.tsx       # Fuzzy search, quick actions
    UpdateBanner.tsx         # Auto-update notification
  hooks/
    useAppsConfig.ts        # Config state, badge tracking, IPC bridge

src-tauri/                  # Rust backend
  src/
    lib.rs                  # Plugin registration, global shortcuts
    config.rs               # Cross-platform config path resolution
    routing.rs              # URL routing, session isolation
    commands/
      webview.rs            # Webview lifecycle, LRU pool, title change detection
      config.rs             # Config CRUD operations
```

## License

MIT

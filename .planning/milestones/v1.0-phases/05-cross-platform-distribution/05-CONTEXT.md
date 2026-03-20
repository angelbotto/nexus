# Phase 5: Cross-Platform Distribution - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Nexus ships installable binaries for all target platforms — macOS universal binary (arm64 + intel), Linux .deb and .AppImage, Windows NSIS installer — with auto-update capability and verified small binary size (<15MB). No code signing for v1.

</domain>

<decisions>
## Implementation Decisions

### Platform-specific UX
- Native title bar per platform: macOS overlay (current), Windows/Linux native title bar with close/minimize/maximize
- cornerRadius on webviews is macOS-only (objc2) — Linux/Windows get square corners, matching native look
- Global shortcuts auto-map Cmd→Ctrl on Windows/Linux — no per-platform shortcut config
- Config path follows OS conventions: macOS ~/.nexus/, Windows %APPDATA%\Nexus\, Linux ~/.config/nexus/ (using dirs crate)

### CI/CD and build pipeline
- GitHub Actions matrix: macos-latest (universal), ubuntu-22.04, windows-latest
- Trigger: on git tag push only (e.g., v0.1.0) — no builds on every commit
- Draft GitHub Release created by CI with all artifacts attached — user reviews and publishes manually
- Repo is private — budget ~200 effective macOS CI minutes/month (10x multiplier)

### Code signing and distribution
- Unsigned on all platforms for v1 — users bypass Gatekeeper (macOS) and SmartScreen (Windows) manually
- Linux .deb includes desktop entry + icon for app launcher integration (Tauri default)
- No Apple Developer account or Windows signing certificate needed for v1

### Auto-updater (tauri-plugin-updater)
- Check for updates on app launch — non-blocking, app loads normally
- Subtle banner notification at bottom: "Update available (v0.2.0) — [Restart]" — dismissible, user clicks when ready
- Update manifest served from GitHub Releases (tauri-plugin-updater native support)
- Silent fail on update error — log and retry next launch, never bother the user

### Binary size
- Standard Tauri release defaults (strip, LTO, opt-level) — expect 5-10MB
- Only optimize further if exceeding 15MB target
- Use `tauri icon` CLI to generate all icon sizes from single 1024x1024 PNG
- Vite defaults sufficient for frontend bundle — no special optimization needed

### Platform testing
- Full manual testing on macOS — VMs (UTM/Parallels) for Windows 11 and Ubuntu 22.04 smoke tests
- Phase 5 checkpoint: macOS verified + CI builds pass for Linux/Windows (pragmatic for solo dev)

### Feature parity
- Platform-native session isolation: macOS=data_store_identifier, Windows=WebView2 user data folder, Linux=webkit2gtk web context
- Activity badges: best-effort on all platforms — if IPC from child webview doesn't work on Linux/Windows, badges silently don't appear
- External link handling: tauri-plugin-opener abstracts platform differences — same UX everywhere

### Claude's Discretion
- Exact GitHub Actions workflow YAML structure
- Tauri bundle config adjustments per platform
- How to handle platform-specific Cargo features and cfg guards
- Auto-updater endpoint configuration details
- Whether to use tauri-action or custom build steps

</decisions>

<specifics>
## Specific Ideas

- Update banner should match the monochromatic Arc aesthetic — subtle, not flashy
- The update flow should be: tag push → CI builds → draft release → user publishes → next app launch detects update → banner shown → user restarts

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `objc2` + `with_webview` block in webview.rs — needs `#[cfg(target_os = "macos")]` guard
- `dirs` crate already in Cargo.toml — use for cross-platform config paths
- `tauri-plugin-opener` already handles cross-platform link opening
- `tauri-plugin-global-shortcut` already abstracts Cmd/Ctrl differences

### Established Patterns
- Rust→React IPC via `main_wv.eval("window.dispatchEvent(new CustomEvent(...))")`
- Config at `~/.nexus/apps.json` via `dirs::home_dir()` — needs platform-aware path update
- `data_store_identifier` for session isolation — macOS-specific, needs platform alternatives

### Integration Points
- `tauri.conf.json` bundle section configures targets, icons, and installer settings
- `Cargo.toml` needs platform-conditional dependencies (objc2 macOS-only)
- GitHub Actions workflow file (.github/workflows/) — new file
- `tauri-plugin-updater` adds to Cargo.toml, lib.rs plugin registration, and frontend update check

</code_context>

<deferred>
## Deferred Ideas

- Code signing (macOS notarization + Windows EV certificate) — future version when user base justifies cost
- Linux Flatpak/Snap distribution — future version
- Periodic background update checks — v1 only checks on launch

</deferred>

---

*Phase: 05-cross-platform-distribution*
*Context gathered: 2026-03-19*

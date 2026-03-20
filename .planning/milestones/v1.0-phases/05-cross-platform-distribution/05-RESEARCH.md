# Phase 5: Cross-Platform Distribution - Research

**Researched:** 2026-03-20
**Domain:** Tauri v2 cross-platform packaging, GitHub Actions CI/CD, auto-updater, binary size
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Platform-specific UX**
- Native title bar per platform: macOS overlay (current), Windows/Linux native title bar with close/minimize/maximize
- cornerRadius on webviews is macOS-only (objc2) — Linux/Windows get square corners, matching native look
- Global shortcuts auto-map Cmd→Ctrl on Windows/Linux — no per-platform shortcut config
- Config path follows OS conventions: macOS ~/.nexus/, Windows %APPDATA%\Nexus\, Linux ~/.config/nexus/ (using dirs crate)

**CI/CD and build pipeline**
- GitHub Actions matrix: macos-latest (universal), ubuntu-22.04, windows-latest
- Trigger: on git tag push only (e.g., v0.1.0) — no builds on every commit
- Draft GitHub Release created by CI with all artifacts attached — user reviews and publishes manually
- Repo is private — budget ~200 effective macOS CI minutes/month (10x multiplier)

**Code signing and distribution**
- Unsigned on all platforms for v1 — users bypass Gatekeeper (macOS) and SmartScreen (Windows) manually
- Linux .deb includes desktop entry + icon for app launcher integration (Tauri default)
- No Apple Developer account or Windows signing certificate needed for v1

**Auto-updater (tauri-plugin-updater)**
- Check for updates on app launch — non-blocking, app loads normally
- Subtle banner notification at bottom: "Update available (v0.2.0) — [Restart]" — dismissible, user clicks when ready
- Update manifest served from GitHub Releases (tauri-plugin-updater native support)
- Silent fail on update error — log and retry next launch, never bother the user

**Binary size**
- Standard Tauri release defaults (strip, LTO, opt-level) — expect 5-10MB
- Only optimize further if exceeding 15MB target
- Use `tauri icon` CLI to generate all icon sizes from single 1024x1024 PNG
- Vite defaults sufficient for frontend bundle — no special optimization needed

**Platform testing**
- Full manual testing on macOS — VMs (UTM/Parallels) for Windows 11 and Ubuntu 22.04 smoke tests
- Phase 5 checkpoint: macOS verified + CI builds pass for Linux/Windows (pragmatic for solo dev)

**Feature parity**
- Platform-native session isolation: macOS=data_store_identifier, Windows=WebView2 user data folder, Linux=webkit2gtk web context
- Activity badges: best-effort on all platforms — if IPC from child webview doesn't work on Linux/Windows, badges silently don't appear
- External link handling: tauri-plugin-opener abstracts platform differences — same UX everywhere

### Claude's Discretion
- Exact GitHub Actions workflow YAML structure
- Tauri bundle config adjustments per platform
- How to handle platform-specific Cargo features and cfg guards
- Auto-updater endpoint configuration details
- Whether to use tauri-action or custom build steps

### Deferred Ideas (OUT OF SCOPE)
- Code signing (macOS notarization + Windows EV certificate) — future version when user base justifies cost
- Linux Flatpak/Snap distribution — future version
- Periodic background update checks — v1 only checks on launch
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-02 | App builds and runs on macOS intel | Universal binary via `--target universal-apple-darwin`; installs both Rust targets in CI |
| PLAT-03 | App builds and runs on Linux (Ubuntu 22.04+) | ubuntu-22.04 runner with libwebkit2gtk-4.1-dev; `.deb` and `.AppImage` via tauri bundle |
| PLAT-04 | App builds and runs on Windows 10/11 | windows-latest runner; NSIS installer; WebView2 bootstrapper; session isolation via `data_directory` |
| PERF-04 | Binary size is small (under 15MB for the app bundle) | `[profile.release]` with LTO, strip, codegen-units=1, opt-level="s"; expect 5-10 MB |
</phase_requirements>

---

## Summary

Phase 5 packages Nexus into installable binaries for macOS (universal), Linux (.deb + .AppImage), and Windows (NSIS) via a GitHub Actions matrix triggered on version tag pushes. The official `tauri-apps/tauri-action@v1` action handles multi-platform builds, creates a draft GitHub Release, and uploads a `latest.json` update manifest that `tauri-plugin-updater` reads on app launch.

The major code changes are: (1) adding platform-conditional `#[cfg]` guards to the existing `objc2` webview corner-radius code, (2) adding `[target.'cfg(target_os = "macos")'.dependencies]` in Cargo.toml to confine objc2 crates to macOS, (3) updating `config_path()` in config.rs to use platform-aware dirs paths instead of `home_dir()`, (4) integrating `tauri-plugin-updater` with a non-blocking launch check and banner UI, and (5) adding platform-specific `tauri.windows.conf.json` and `tauri.linux.conf.json` overrides for window decorations. Session isolation on Windows/Linux uses `data_directory(PathBuf)` instead of the macOS-only `data_store_identifier([u8;16])`.

**Primary recommendation:** Use `tauri-apps/tauri-action@v1` with a matrix strategy; keep the workflow simple and tag-triggered. Platform differences are small and mostly resolved via `#[cfg]` guards and platform override config files.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-apps/tauri-action | v1 | CI build + GitHub Release creation | Official Tauri action; handles artifact upload, draft releases, `latest.json` |
| tauri-plugin-updater | 2.x | In-app update checks | Official plugin; GitHub Releases endpoint built-in |
| tauri-plugin-process | 2.x | `relaunch()` after update installs | Required companion to updater for restart |
| dtolnay/rust-toolchain | stable | Rust setup in CI | De facto standard for Rust CI |
| swatinem/rust-cache | v2 | Rust build cache | Halves subsequent CI build times |
| actions/setup-node | v4 | Node.js for frontend build | Standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-updater | 2.x | Frontend JS update API | Pair with Rust tauri-plugin-updater |
| @tauri-apps/plugin-process | 2.x | Frontend `relaunch()` | After `update.downloadAndInstall()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-action | Custom `cargo tauri build` steps | tauri-action wraps complex multi-arch logic; custom steps give more control but add 50+ lines of YAML |
| GitHub Releases endpoint | CrabNebula Cloud / S3 | Free for open-source; private repos still work with GITHUB_TOKEN |

**Installation:**
```bash
npm run tauri add updater
npm run tauri add process
```

Cargo.toml additions (via the above, or manually):
```toml
[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"

[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.6"
objc2-quartz-core = { version = "0.3", features = ["CALayer"] }
objc2-app-kit = { version = "0.3", features = ["NSView"] }
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
.github/
└── workflows/
    └── publish.yml          # Tag-triggered CI/CD workflow

src-tauri/
├── Cargo.toml               # Add cfg-conditional deps; add [profile.release] block
├── tauri.conf.json          # Add bundle.createUpdaterArtifacts; plugins.updater
├── tauri.windows.conf.json  # Override: titleBarStyle → default, decorations enabled
├── tauri.linux.conf.json    # Override: titleBarStyle → default, decorations enabled
├── capabilities/
│   └── default.json         # Add updater:default permission
└── src/
    ├── lib.rs               # Add tauri-plugin-updater + tauri-plugin-process registration
    ├── config.rs            # Update config_path() for platform-aware dirs
    └── commands/
        └── webview.rs       # Wrap objc2 corner-radius in #[cfg(target_os = "macos")]
```

Frontend additions:
```
src/
└── components/
    └── UpdateBanner.tsx     # Non-blocking update notification banner
```

### Pattern 1: Tag-Triggered GitHub Actions Matrix

**What:** One workflow file with a 3-entry matrix (macOS universal, ubuntu-22.04, windows-latest) triggering on `v*` tag pushes.
**When to use:** Solo dev shipping v0.x releases on demand.

```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
name: publish
on:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target universal-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: install frontend dependencies
        run: npm install

      - uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'Nexus v__VERSION__'
          releaseBody: 'See Assets to download and install.'
          releaseDraft: true
          prerelease: false
          uploadUpdaterJson: true
          args: ${{ matrix.args }}
```

**CI minutes note (private repo):** macOS runner costs 10x. One universal build = ~15-20 min effective macOS time. Ubuntu and Windows are 1x and 2x respectively. Caching Rust artifacts with `swatinem/rust-cache` cuts subsequent runs by ~50%.

### Pattern 2: Platform-Conditional Cargo Dependencies

**What:** Move macOS-only crates (objc2, objc2-quartz-core, objc2-app-kit) into `[target.'cfg(target_os = "macos")'.dependencies]` so Linux/Windows builds never try to compile them.
**When to use:** Any time a dependency only makes sense on one OS.

```toml
# Source: Cargo documentation + Tauri plugin examples
[dependencies]
tauri = { version = "2", features = ["unstable"] }
tauri-plugin-fs = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dirs = "5"
uuid = { version = "1", features = ["v4"] }
md5 = "0.7"
tauri-plugin-global-shortcut = "2.3.1"

[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.6"
objc2-quartz-core = { version = "0.3", features = ["CALayer"] }
objc2-app-kit = { version = "0.3", features = ["NSView"] }

[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

### Pattern 3: Platform Override Config Files

**What:** `tauri.windows.conf.json` and `tauri.linux.conf.json` override only the keys that differ. The base `tauri.conf.json` keeps macOS settings (titleBarStyle: Overlay). Merging follows RFC 7396 JSON Merge Patch.
**When to use:** Per-platform window decoration differences.

```json
// tauri.windows.conf.json — remove overlay, use native decorations
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Nexus",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "theme": "Dark",
        "titleBarStyle": "Visible",
        "decorations": true
      }
    ]
  }
}
```

```json
// tauri.linux.conf.json — same as windows override
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Nexus",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "theme": "Dark",
        "titleBarStyle": "Visible",
        "decorations": true
      }
    ]
  }
}
```

### Pattern 4: Platform-Aware Session Isolation

**What:** `data_store_identifier` is macOS 14+ only. For Windows/Linux session isolation, use `data_directory(PathBuf)` with per-app unique paths.
**When to use:** Multi-webview session isolation outside macOS.

```rust
// Source: docs.rs/tauri/2.2.0/tauri/webview/struct.WebviewBuilder.html
let child_wv = main_window.add_child(
    WebviewBuilder::new(&label, WebviewUrl::External(url))
        // macOS-only:
        #[cfg(target_os = "macos")]
        .data_store_identifier(store_id)
        // Windows/Linux:
        #[cfg(not(target_os = "macos"))]
        .data_directory(platform_data_dir(&app_id))
        // ... rest of builder
```

The `platform_data_dir` helper:
```rust
fn platform_data_dir(app_id: &str) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Nexus").join("webdata").join(app_id)
    }
    #[cfg(target_os = "linux")]
    {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("nexus").join("webdata").join(app_id)
    }
    #[cfg(target_os = "macos")]
    {
        // Unused on macOS; data_store_identifier handles it
        PathBuf::new()
    }
}
```

**Windows constraint:** All WebView2 webviews sharing a user data folder must receive the same `data_directory` value. Use unique per-app subdirectories to ensure true isolation.

### Pattern 5: Platform-Aware Config Path

**What:** `config_path()` currently uses `dirs::home_dir()` which gives `~/.nexus/apps.json` on all platforms. This must become platform-aware.

```rust
// Updated config_path() in config.rs
pub fn config_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let mut path = dirs::home_dir().expect("cannot resolve home dir");
        path.push(".nexus");
        path.push("apps.json");
        path
    }
    #[cfg(target_os = "windows")]
    {
        let mut path = dirs::config_dir().expect("cannot resolve config dir");
        // config_dir() on Windows → %APPDATA% (Roaming)
        path.push("Nexus");
        path.push("apps.json");
        path
    }
    #[cfg(target_os = "linux")]
    {
        let mut path = dirs::config_dir().expect("cannot resolve config dir");
        // config_dir() on Linux → $XDG_CONFIG_HOME or ~/.config
        path.push("nexus");
        path.push("apps.json");
        path
    }
}
```

### Pattern 6: Non-Blocking Updater Check on App Launch

**What:** Check for update asynchronously after app startup; show dismissible banner if update found.

```rust
// In lib.rs setup(), after other initialization
#[cfg(desktop)]
{
    let handle = app.handle().clone();
    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
    app.handle().plugin(tauri_plugin_process::init())?;
    // Kick off update check in background — non-blocking
    tauri::async_runtime::spawn(async move {
        let _ = handle.emit("check-update", ());
    });
}
```

Frontend (UpdateBanner.tsx):
```typescript
// Source: https://v2.tauri.app/plugin/updater/
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// Called once on app mount, non-blocking
async function checkForUpdate(setBannerVersion) {
  try {
    const update = await check();
    if (update?.available) {
      setBannerVersion(update.version);
    }
  } catch {
    // Silent fail — log only
  }
}

// On user clicking "Restart":
async function applyUpdate(version) {
  const update = await check();
  if (update?.available) {
    await update.downloadAndInstall();
    await relaunch();
  }
}
```

### Pattern 7: Binary Size Profile

**What:** Recommended `[profile.release]` for Tauri apps targeting small binary size.
**Expected result:** 5-10 MB for Nexus (minimal Rust + small React bundle).

```toml
# Source: https://v2.tauri.app/concept/size/
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

### Pattern 8: Global Shortcut Cross-Platform (Modifiers::SUPER vs CTRL)

The existing code uses `Modifiers::SUPER` for all shortcuts. On macOS, SUPER = Command key. On Linux/Windows, SUPER = Meta/Windows key — NOT Ctrl. The `CommandOrControl` abstraction in the JavaScript API handles this correctly, but the Rust `tauri-plugin-global-shortcut` API requires explicit modifier handling.

**Decision (from CONTEXT.md):** "Global shortcuts auto-map Cmd→Ctrl on Windows/Linux — no per-platform shortcut config." This means replacing `Modifiers::SUPER` with `Modifiers::META | Modifiers::CONTROL` on non-macOS platforms, or using a cross-platform helper:

```rust
#[cfg(target_os = "macos")]
fn cmd_modifier() -> Modifiers { Modifiers::SUPER }
#[cfg(not(target_os = "macos"))]
fn cmd_modifier() -> Modifiers { Modifiers::CONTROL }
```

### Anti-Patterns to Avoid
- **`data_store_identifier` without `#[cfg(target_os = "macos")]`:** Calling it on Windows/Linux will cause a compile error. The docs explicitly state "Windows/Linux/Android: Unsupported."
- **`objc2` in `[dependencies]` without cfg guard:** Will fail to compile on Linux/Windows — put it in `[target.'cfg(target_os = "macos")'.dependencies]`.
- **`Modifiers::SUPER` on all platforms:** On Windows/Linux, SUPER is the Windows/Meta key, not Ctrl. Use `#[cfg]` guards or a helper function.
- **`home_dir()` for config on all platforms:** On Windows this gives `C:\Users\name` which is not the conventional app data location. Use `dirs::config_dir()`.
- **Universal binary on every PR:** Universal builds double compile time (two Rust targets). Trigger CI only on tags.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-platform GitHub Release creation | Custom gh CLI scripts | tauri-action@v1 | Handles artifact naming, dmg/deb/exe, `latest.json` generation, tag templating |
| Update manifest server | Custom API | GitHub Releases + `latest.json` | tauri-plugin-updater has native GitHub Releases support; zero infra |
| Update signing | Custom HMAC | `tauri signer generate` + TAURI_SIGNING_PRIVATE_KEY | Tauri's .sig files are mandatory; plugin validates them automatically |
| Platform-specific session paths | Custom resolver | `dirs` crate (already in Cargo.toml) | Handles XDG, %APPDATA%, ~/Library correctly |
| Icon resizing | Manual imagemagick | `npm run tauri icon <path>` | Generates all required sizes (32x32, 128x128, 128@2x, .icns, .ico) from one PNG |

---

## Common Pitfalls

### Pitfall 1: objc2 Crates Fail on Linux/Windows
**What goes wrong:** `error[E0432]: unresolved import objc2` on Linux/Windows CI. Entire build fails.
**Why it happens:** objc2 crates are macOS/iOS only; the linker cannot find Objective-C symbols on other platforms.
**How to avoid:** Move all three objc2 crates to `[target.'cfg(target_os = "macos")'.dependencies]` and wrap all usage in `#[cfg(target_os = "macos")]`.
**Warning signs:** CI matrix fails immediately on the compile step for ubuntu/windows jobs.

### Pitfall 2: data_store_identifier Called on Windows/Linux
**What goes wrong:** Compile error or runtime panic; `data_store_identifier` is marked "macOS >= 14 and iOS >= 17 only."
**Why it happens:** Code was written macOS-first; `#[cfg]` guard was not added.
**How to avoid:** Wrap the entire `data_store_identifier(store_id)` call in `#[cfg(target_os = "macos")]` and provide `data_directory(path)` for other platforms.
**Warning signs:** CI Windows/Linux jobs fail during Rust compilation with a cfg-attribute or missing-method error.

### Pitfall 3: Missing Ubuntu System Dependencies
**What goes wrong:** `cargo build` fails with linker errors about missing webkit2gtk or appindicator symbols.
**Why it happens:** The ubuntu-22.04 runner is minimal; webkit2gtk-4.1-dev is not pre-installed.
**How to avoid:** Always include the `apt-get install` step in the workflow for ubuntu jobs: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`.
**Warning signs:** Linker error mentioning `webkit2gtk` or `appindicator` in the CI log.

### Pitfall 4: Updater Requires Signed Artifacts — Fails Without Key
**What goes wrong:** `tauri build` succeeds but `latest.json` contains empty signatures, or CI fails because `TAURI_SIGNING_PRIVATE_KEY` is not set.
**Why it happens:** `createUpdaterArtifacts: true` in tauri.conf.json requires a signing key to produce valid .sig files.
**How to avoid:** Generate key pair once with `npm run tauri signer generate -- -w ~/.tauri/nexus.key`; store private key as `TAURI_SIGNING_PRIVATE_KEY` GitHub secret; store public key in `tauri.conf.json` `plugins.updater.pubkey`.
**Warning signs:** `latest.json` uploaded but update check fails with signature mismatch on clients.

### Pitfall 5: SUPER Modifier Means Windows Key on Windows/Linux
**What goes wrong:** Keyboard shortcuts stop working on Windows/Linux because `Modifiers::SUPER` registers against the Windows/Meta key, not Ctrl.
**Why it happens:** SUPER = Command on macOS, but SUPER = Meta/Windows key on Linux/Windows.
**How to avoid:** Use `#[cfg]` helper to select `Modifiers::SUPER` on macOS and `Modifiers::CONTROL` on Windows/Linux.
**Warning signs:** Users on Windows report Cmd+1/B/K/R shortcuts don't trigger app switching.

### Pitfall 6: Universal Binary Doubles CI macOS Minutes
**What goes wrong:** Builds take 30-40 min on macOS runner instead of 15-20 min, burning the private repo minute budget quickly.
**Why it happens:** `--target universal-apple-darwin` compiles twice (aarch64 + x86_64) then lipo-combines.
**How to avoid:** This is unavoidable for universal binary. Mitigate with `swatinem/rust-cache`. Consider whether intel binary is needed for v1 (PLAT-02 requires it, so yes).
**Warning signs:** CI bills showing >200 macOS-equivalent minutes/month.

### Pitfall 7: tauri.conf.json titleBarStyle: "Overlay" Breaks Windows Title Bar
**What goes wrong:** On Windows, `titleBarStyle: "Overlay"` removes native window chrome. Users can't move, minimize, or close the window.
**Why it happens:** `titleBarStyle` in the base config was set for macOS traffic-lights overlay UX; applied globally it removes all decorations on other platforms.
**How to avoid:** Use `tauri.windows.conf.json` and `tauri.linux.conf.json` overrides to reset to `"titleBarStyle": "Visible"` and `"decorations": true`.
**Warning signs:** Windows/Linux builds show an app with no title bar, window controls, or drag region.

---

## Code Examples

### Updater Configuration in tauri.conf.json
```json
// Source: https://v2.tauri.app/plugin/updater/
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": [...]
  },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT_FROM_PUBLICKEY_PEM",
      "endpoints": [
        "https://github.com/angelbotto/nexus/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Key Generation (run once, store in GitHub Secrets)
```bash
npm run tauri signer generate -- -w ~/.tauri/nexus.key
# outputs: nexus.key (private) + nexus.key.pub (public)
# Put nexus.key content → GitHub Secret: TAURI_SIGNING_PRIVATE_KEY
# Put nexus.key.pub content → tauri.conf.json plugins.updater.pubkey
```

### Capabilities Permission for Updater
```json
// src-tauri/capabilities/default.json — add to permissions array
{
  "permissions": [
    "...",
    "updater:default",
    "process:allow-relaunch"
  ]
}
```

### Icon Generation
```bash
# Source: Tauri CLI docs
npm run tauri icon path/to/nexus-icon-1024.png
# Generates: src-tauri/icons/{32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WiX `.msi` installer | NSIS is now Tauri default for Windows | Tauri v2 | NSIS handles per-user installs without elevation better |
| tauri-action@v0 | tauri-action@v1 (uploadUpdaterJson param) | 2024-2025 | v1 exposes `uploadUpdaterJson` flag explicitly |
| `data_directory` for macOS session isolation | `data_store_identifier([u8;16])` for macOS | macOS 14+ | WKWebView limitation; data_directory still works on Windows/Linux |
| Separate x86_64 + aarch64 macOS builds | `universal-apple-darwin` target | Tauri v2 | Single `.dmg` runs on both architectures |

**Deprecated/outdated:**
- `tauri.conf.json > app > updater` (Tauri v1 style): In Tauri v2, updater config lives under `plugins.updater`, not `app.updater`.
- `tauri-action@v0`: Still works but `@v1` exposes `uploadUpdaterJson` and `uploadUpdaterSignatures` params directly.

---

## Open Questions

1. **Modifiers::SUPER on Linux — Meta or Super key?**
   - What we know: On Linux, `Modifiers::SUPER` may map to the Super/Windows key (XKB). Some desktop environments capture this key globally.
   - What's unclear: Whether registered shortcuts with SUPER are reliable on all Linux DEs (GNOME, KDE, etc.).
   - Recommendation: Use `Modifiers::CONTROL` on Linux/Windows in the `cmd_modifier()` helper. This matches the "auto-map Cmd→Ctrl" decision in CONTEXT.md.

2. **WebView2 data_directory: same-value constraint**
   - What we know: The docs warn "On Windows, the data directory option must be given the same value for all webviews that target the same data directory."
   - What's unclear: Whether unique per-app subdirectories (e.g., `%LOCALAPPDATA%/Nexus/webdata/gmail`) satisfy this — each app-webview gets its own unique path, so each WebView2 process gets a unique user data folder.
   - Recommendation: Use unique subdirectory per `app_id`; this avoids the shared-folder constraint entirely.

3. **activity badges on Windows/Linux via MutationObserver IPC**
   - What we know: The MutationObserver init_script uses `window.__TAURI_INTERNALS__.invoke()` which is already wrapped in `try/catch`.
   - What's unclear: Whether WebView2 and webkit2gtk expose `__TAURI_INTERNALS__` in child webviews the same way WKWebView does.
   - Recommendation: The existing try/catch is sufficient — badges silently degrade per CONTEXT.md decision. No additional work needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (frontend) + cargo test (Rust) |
| Config file | vite.config.ts (Vitest co-located) / Cargo.toml |
| Quick run command | `npm test` (Vitest) or `cargo test --manifest-path src-tauri/Cargo.toml` |
| Full suite command | `npm test && cargo test --manifest-path src-tauri/Cargo.toml` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-02 | macOS universal binary builds and runs on intel | smoke/manual | CI green on `--target universal-apple-darwin` | ❌ Wave 0 (CI workflow) |
| PLAT-03 | Linux .deb and .AppImage build without dependency errors | smoke/manual | CI green on ubuntu-22.04 runner | ❌ Wave 0 (CI workflow) |
| PLAT-04 | Windows NSIS installer builds; shortcuts/sessions work | smoke/manual | CI green on windows-latest runner; manual VM test | ❌ Wave 0 (CI workflow) |
| PERF-04 | Binary size < 15 MB on all platforms | smoke | Check artifact size in CI; `ls -lh target/release/bundle/` | ❌ Wave 0 (CI step) |

**Note:** All four requirements are primarily verified by CI build success and manual smoke testing, not automated unit tests. The Rust unit tests in `config.rs` and `routing.rs` remain valid for regression but do not cover the new cross-platform behavior. New Rust unit tests can verify `config_path()` output and `platform_data_dir()` logic via `#[cfg(test)]` mocks.

### Sampling Rate
- **Per task commit:** `cargo test --manifest-path src-tauri/Cargo.toml` (Rust unit tests, < 10s)
- **Per wave merge:** `npm test && cargo test --manifest-path src-tauri/Cargo.toml`
- **Phase gate:** Full CI matrix passes (all 3 platforms build and artifact sizes confirmed) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `.github/workflows/publish.yml` — covers PLAT-02, PLAT-03, PLAT-04 (CI builds)
- [ ] CI step to assert artifact size < 15 MB for PERF-04
- [ ] `src-tauri/Cargo.toml` `[profile.release]` block — prerequisite for size verification
- [ ] `src-tauri/tauri.conf.json` `createUpdaterArtifacts: true` + `plugins.updater` — required before CI can produce valid `latest.json`

---

## Sources

### Primary (HIGH confidence)
- [https://v2.tauri.app/distribute/pipelines/github/](https://v2.tauri.app/distribute/pipelines/github/) — Full GitHub Actions workflow YAML
- [https://v2.tauri.app/plugin/updater/](https://v2.tauri.app/plugin/updater/) — Updater plugin setup, config, JS API
- [https://v2.tauri.app/concept/size/](https://v2.tauri.app/concept/size/) — Cargo profile.release settings
- [https://v2.tauri.app/develop/configuration-files/](https://v2.tauri.app/develop/configuration-files/) — Platform-specific config file merging
- [https://v2.tauri.app/learn/window-customization/](https://v2.tauri.app/learn/window-customization/) — titleBarStyle per platform
- [https://docs.rs/tauri/2.2.0/tauri/webview/struct.WebviewBuilder.html](https://docs.rs/tauri/2.2.0/tauri/webview/struct.WebviewBuilder.html) — data_store_identifier platform availability, data_directory method
- [https://github.com/tauri-apps/tauri-action/blob/dev/README.md](https://github.com/tauri-apps/tauri-action/blob/dev/README.md) — tauri-action@v1 inputs: releaseDraft, uploadUpdaterJson

### Secondary (MEDIUM confidence)
- [https://v2.tauri.app/distribute/windows-installer/](https://v2.tauri.app/distribute/windows-installer/) — NSIS installer config options
- [https://v2.tauri.app/plugin/global-shortcut/](https://v2.tauri.app/plugin/global-shortcut/) — Modifier key cross-platform behavior
- [https://thatgurjot.com/til/tauri-auto-updater/](https://thatgurjot.com/til/tauri-auto-updater/) — GitHub Releases latest.json endpoint URL pattern (verified against official docs)

### Tertiary (LOW confidence)
- Various community discussions on WebView2 data_directory same-value constraint — referenced from a search snippet, not directly verified against official Tauri v2 docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries are official Tauri plugins/actions verified from v2.tauri.app
- Architecture: HIGH — Patterns derived from official docs and verified Rust API docs
- Pitfalls: HIGH (compile errors, SUPER modifier) / MEDIUM (WebView2 data_directory constraint, activity badges on non-macOS)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Tauri v2 is stable; updater and action APIs change infrequently)

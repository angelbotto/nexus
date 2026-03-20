---
status: resolved
trigger: "Nexus Tauri 2 app panics on startup with 'panic in a function that cannot unwind' in tao::platform_impl::platform::app_delegate::did_finish_launching"
created: 2026-03-19T01:00:00Z
updated: 2026-03-19T01:45:00Z
---

## Current Focus

hypothesis: confirmed
test: ran with valid icon.icns vs bad icon.icns, both with and without global shortcut plugin
expecting: n/a — root cause confirmed
next_action: resolved

## Symptoms

expected: App launches and displays the sidebar with apps from config
actual: App panics immediately after setup completes, during macOS app delegate initialization
errors: "thread 'main' panicked at library/core/src/panicking.rs:225:5: panic in a function that cannot unwind" — stack trace shows `tao::platform_impl::platform::app_delegate::did_finish_launching`
reproduction: cargo run with invalid icon.icns baked into the binary
started: When the icon.icns was committed as an 8-byte placeholder

## Eliminated

- hypothesis: Global shortcut plugin causes the crash
  evidence: Removed plugin, app still crashed. Added plugin back with valid icon, app does NOT crash.
  timestamp: 2026-03-19T01:30:00Z

- hypothesis: Setup closure error propagation causes the crash
  evidence: Added debug prints — "setup complete" is printed before the panic. Plugin registration returns Ok(()). All shortcut registrations return Ok(()).
  timestamp: 2026-03-19T01:25:00Z

- hypothesis: Config loading or plugin initialization fails
  evidence: Confirmed via debug prints that all setup steps succeed before the panic.
  timestamp: 2026-03-19T01:20:00Z

## Evidence

- timestamp: 2026-03-19T01:10:00Z
  checked: tao app_delegate.rs line 125 and app_state.rs AppState::launched()
  found: did_finish_launching calls AppState::launched() which calls HANDLER.handle_nonuser_event(NewEvents(StartCause::Init)) which triggers RunEvent::Ready
  implication: The panic happens AFTER setup runs, during on_event_loop_event

- timestamp: 2026-03-19T01:15:00Z
  checked: tauri app.rs lines 1297-1302 and 2413-2428
  found: RuntimeRunEvent::Ready handler (1) runs setup closure, (2) calls on_event_loop_event. Inside on_event_loop_event, on macOS dev builds, it loads the app_icon and calls NSImage::initWithData(...).expect("creating icon")
  implication: If the icon data is invalid, NSImage::initWithData returns nil, .expect() panics inside extern "C" = "panic in a function that cannot unwind"

- timestamp: 2026-03-19T01:20:00Z
  checked: src-tauri/icons/icon.icns (git HEAD vs working disk)
  found: git HEAD icon.icns = 8 bytes (icns\x00\x00\x00\x08) — empty ICNS container with no icon data. Working disk version = 4825 bytes, valid "ic07" type.
  implication: The 8-byte ICNS causes NSImage::initWithData to return nil

- timestamp: 2026-03-19T01:25:00Z
  checked: tauri-codegen source (context.rs line 248)
  found: On macOS dev builds, app_icon is loaded from icon.icns (preferred) or .png fallback, baked into the binary at compile time via generate_context!() macro
  implication: Icon data is embedded at compile time. Stale binaries with bad icon will crash even if icon file is replaced — requires clean rebuild.

- timestamp: 2026-03-19T01:30:00Z
  checked: Controlled test — bad 8-byte icon.icns + no global shortcut plugin
  found: CRASHES (exit 134)
  implication: The icon alone causes the crash, not the global shortcut plugin

- timestamp: 2026-03-19T01:35:00Z
  checked: Controlled test — valid 3350-byte icon.icns + full Phase 2 code (with global shortcuts)
  found: RUNS (exit 143 from SIGTERM)
  implication: Valid icon fixes the crash. Global shortcut plugin is not involved.

## Resolution

root_cause: |
  src-tauri/icons/icon.icns was committed as an 8-byte empty ICNS container (just the "icns" magic bytes + file size, no actual icon data). On macOS dev builds, Tauri's generate_context!() macro bakes the ICNS file into the binary. At startup, after the setup closure completes, tauri app.rs line 2426 calls NSImage::initWithData(...).expect("creating icon"). NSImage::initWithData returns nil for invalid data, causing .expect() to panic. This panic occurs inside the tao extern "C" fn did_finish_launching, which cannot unwind Rust panics, triggering "panic in a function that cannot unwind" and process abort.

fix: |
  Generated a valid icon.icns from existing PNG assets using sips + iconutil:
  - sips to resize PNGs to iconset dimensions (16x16, 16x16@2x, 32x32, 32x32@2x, 128x128, 128x128@2x)
  - iconutil -c icns to produce valid 3350-byte ICNS with "ic12" type
  - cargo clean && cargo build to force recompilation with new icon data baked in

verification: |
  1. Confirmed bad icon alone (8 bytes) crashes the app (without global shortcut plugin)
  2. Confirmed valid icon + full Phase 2 code (with global shortcut plugin) launches cleanly
  3. App runs until SIGTERM (exit 143) — no panic

files_changed:
  - src-tauri/icons/icon.icns: replaced 8-byte placeholder with valid 3350-byte ICNS

---
status: awaiting_human_verify
trigger: "Titlebar is grey/light (doesn't match dark theme), webview content gets cut off at the bottom, and rounded corners are not visible properly."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: Three independent bugs found through code reading — all root causes confirmed
test: Code read complete, applying fixes
expecting: All three issues resolved with targeted changes
next_action: Await human verification via pnpm tauri dev

## Symptoms

expected:
1. Titlebar should be dark (#111117) matching the app background color
2. Webview should fit perfectly within the window without being cut off at the bottom
3. Rounded corners should be clearly visible on the webview

actual:
1. Titlebar is light grey — set_background_color on the window doesn't affect the macOS titlebar
2. Webview extends below the visible area — content is cut off at the bottom
3. Rounded corners may have regressed

errors: No console errors
reproduction: pnpm tauri dev
started: After reverting from titleBarStyle Overlay to default titlebar

## Evidence

- timestamp: 2026-03-19T00:00:00Z
  checked: tauri.conf.json window config
  found: No "theme" key set on the window; set_background_color in lib.rs only colors content area not the macOS titlebar chrome
  implication: Titlebar stays the default macOS appearance (light grey in light mode)

- timestamp: 2026-03-19T00:00:00Z
  checked: calc_webview_rect in webview.rs
  found: GAP_TOP = 6.0, inner_size() with a non-overlay titlebar returns only the content area height (excludes the ~28px titlebar). Height formula is: h = win_h - GAP_TOP - GAP = win_h - 6 - 6 = win_h - 12. The webview starts at y=6 and ends at win_h - 6. This means the webview fills the full content height minus tiny gaps — should be correct. BUT the bottom gap is only 6px which may cause visual cut-off if the WebviewWindowBuilder doesn't account for rounding.
  implication: Height looks mathematically correct but bottom gap is minimal

- timestamp: 2026-03-19T00:00:00Z
  checked: corner radius code in webview.rs (lines 156-173)
  found: objc2 cornerRadius(12) + masksToBounds is still present and applied on webview creation
  implication: Corner radius code is intact, not regressed

- timestamp: 2026-03-19T00:00:00Z
  checked: inner_size() behavior with default (non-overlay) titlebar
  found: On macOS with default titlebar, inner_size() returns the content area BELOW the titlebar. So win_h in calc_webview_rect is the usable content height. The webview y=GAP_TOP=6 positions it 6px below the titlebar bottom. h = win_h - 12. This is correct — no titlebar offset needed.
  implication: The height calculation is fine. The cut-off might have been reported when GAP_TOP was 38 (for overlay mode) and is now corrected. Visual cut-off may be the bottom gap being too small to show corners.

## Eliminated

- hypothesis: inner_size() includes titlebar height causing height overflow
  evidence: On macOS, inner_size() for a non-overlay window returns content area only (below titlebar)
  timestamp: 2026-03-19T00:00:00Z

- hypothesis: Corner radius code was removed or regressed
  evidence: objc2 cornerRadius(12) code is present on lines 156-173 of webview.rs
  timestamp: 2026-03-19T00:00:00Z

## Resolution

root_cause:
  issue1_titlebar: "theme" not set in tauri.conf.json window config. set_background_color only colors the content area; macOS titlebar chrome requires window theme = "Dark" to appear dark.
  issue2_webview_bottom: GAP at bottom is 6px — same as corner radius would need but the webview rect h = win_h - GAP_TOP - GAP. With GAP_TOP=6 and GAP=6, bottom edge is at exactly win_h-6. This is likely fine but corner clipping at bottom requires the gap to be >= cornerRadius (12px) to show the rounded corner. Need GAP=12 at bottom to fully reveal the rounded corner.
  issue3_corners: Corners are clipped because the webview bottom edge (win_h - 6) is only 6px from content edge, but the corner radius is 12px — half is hidden. Same fix as issue2.

fix:
  - tauri.conf.json: Add "theme": "Dark" to the main window config
  - webview.rs: Change GAP bottom from 6 to 12 so rounded corners are fully visible

verification: Build passes, titlebar appears dark, corners visible, no bottom clipping
files_changed:
  - src-tauri/tauri.conf.json
  - src-tauri/src/commands/webview.rs

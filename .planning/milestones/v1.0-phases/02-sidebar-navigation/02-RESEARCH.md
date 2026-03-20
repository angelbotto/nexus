# Phase 2: Sidebar & Navigation - Research

**Researched:** 2026-03-19
**Domain:** Tauri 2 global shortcuts (Rust) + React sidebar refactor (groups, collapse, active state) + Tailwind CSS v4 dark-mode aesthetics
**Confidence:** HIGH (core APIs verified against official Tauri docs and codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Arc dark mode aesthetic:** Sidebar background #111117 (custom, darker than gray-900). Main area bg-gray-950. Monochromatic — no accent color. Active = `bg-white/10 + text-white`. Hover = `bg-white/5`. Inactive = `text-gray-400`.
- **Webview card:** `rounded-lg` border radius, visible gap/margin around it so the dark window background shows between sidebar and webview — "floating card" effect.
- **No separator** between sidebar and content — tone difference + gap creates the separation.
- **No "Nexus" title** in sidebar header. Apps only.
- **Collapsible groups:** Header = uppercase text + chevron that rotates when collapsed. Click header to toggle. `collapsed` field persisted in apps.json on each group object.
- **"Other" group:** No header, always visible, apps without a valid group ID go here, rendered last.
- **Default state:** All groups expanded (`collapsed: false`) on first run.
- **Sidebar collapse (Cmd+B):** Sidebar disappears completely (webview goes fullscreen). No animation — instant. Persisted across restarts via top-level `sidebarCollapsed` field in apps.json. No auto-show on hover.
- **Active indicator:** `bg-white/10 + text-white`. No side border, no glow.
- **Hover state:** `bg-white/5`.
- **No shortcut numbers visible** (Cmd+1–9 are invisible — clean interface).
- **Startup:** Auto-load last used app (`lastActiveAppId` top-level field in apps.json). Show empty state if first run or app no longer exists.
- **Cmd+R:** Silent reload of active webview. No visual feedback.
- **Favicon fallback:** Google Favicon API (no local cache). If favicon fails to load: first letter of app name in gray circle.
- **All shortcuts registered in Rust** via `tauri-plugin-global-shortcut` (decided Phase 1 — webviews steal keyboard focus).
- **Cmd+1–9 jumps by global position** (index in flat apps array), not per-group position.

### Claude's Discretion
- Exact pixel size of gap/margin around the webview card.
- Exact border-radius value for webview card (rounded-lg vs rounded-xl vs custom).
- Typography and spacing of sidebar (font size, padding, line height).
- Chevron implementation (SVG inline, Lucide icon, CSS transform).
- How to represent `sidebarCollapsed` in apps.json (top-level field vs nested in a `ui` object).
- Exact color value for sidebar background (can tweak from #111117).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | User sees a collapsible sidebar on the left with app icons and labels | GroupConfig.collapsed field + React group rendering + Tailwind collapse state |
| NAV-02 | User can toggle sidebar visibility with Cmd+B | `tauri-plugin-global-shortcut` Rust handler + `sidebarCollapsed` in apps.json + React conditional render |
| NAV-03 | Apps are visually grouped in sidebar by their `group` field (collapsible sections) | Group header with chevron, per-group collapsed state, "Other" bucket for ungrouped apps |
| NAV-04 | User can click an app in sidebar to switch to its webview | Existing `switch_app` IPC + React `onClick` — already works, needs style update only |
| NAV-05 | Active app is visually highlighted in sidebar | `bg-white/10 text-white` Tailwind classes on active item |
| KEY-01 | User can press Cmd+1..9 to jump to apps by position | `Modifiers::SUPER + Code::Digit1..9` registered in Rust setup(), emit event to frontend or call switch_app directly |
| KEY-02 | User can press Cmd+R to reload the active webview | Rust shortcut handler calls `webview_window.eval("location.reload()")` |
| KEY-03 | User can press Cmd+B to toggle sidebar | Rust shortcut handler emits event to frontend OR updates persisted state; React reads `sidebarCollapsed` |
| WEB-08 | User can reload current webview with Cmd+R | `WebviewWindow::eval("location.reload()")` from Rust after looking up active_app_id in AppState |
| VIS-01 | App uses dark mode with minimalist Arc-inspired aesthetic | Tailwind v4 custom color via `@theme` in CSS — sidebar #111117, main bg-gray-950 |
| VIS-02 | Sidebar is thin/narrow with icons and short labels | Current 220px width is fine; favicon 16px + truncated label stays |
| VIS-04 | Fullscreen webview area when sidebar is collapsed | `sidebarCollapsed` state causes `<Sidebar>` to not render; `<main>` fills 100% width |
</phase_requirements>

---

## Summary

Phase 2 is primarily a **React refactor + Rust shortcut registration** phase. The core webview infrastructure (session isolation, IPC, file watcher) is complete from Phase 1. What remains is:

1. Refactoring `Sidebar.tsx` from a flat list into grouped, collapsible sections with Arc-inspired dark-mode styling.
2. Extending `types.ts`, `config.rs`, and `apps.json` with three new fields: `GroupConfig.collapsed`, `NexusConfig.sidebarCollapsed`, `NexusConfig.lastActiveAppId`.
3. Installing `tauri-plugin-global-shortcut` and registering `Cmd+1–9`, `Cmd+B`, `Cmd+R` in Rust `lib.rs` setup.
4. Adding a `reload_webview` Rust command and wiring `Cmd+R` to call `eval("location.reload()")` on the active webview.
5. Persisting sidebar collapse state and last-active app to `apps.json` via a new `save_config` IPC command.

The most technically constrained part is global shortcut registration: shortcuts MUST be in Rust (webviews steal focus from React), and the `tauri-plugin-global-shortcut` is not yet installed in this project.

The Tailwind v4 dark-mode theming approach uses `@theme` inline in CSS to define custom colors — no `tailwind.config.js` needed. The sidebar's #111117 color is darker than Tailwind's `gray-900` (`#111827`) so it requires a custom CSS variable.

**Primary recommendation:** Register all shortcuts in `lib.rs` setup using `tauri_plugin_global_shortcut::Builder::with_handler`. For Cmd+R and Cmd+B, emit a Tauri event to the React shell (`app.emit("cmd-b")`) so the frontend can toggle the sidebar state. For Cmd+1–9, call `switch_app` directly from the Rust handler (no round-trip to frontend needed).

---

## Standard Stack

### Core (all already in Cargo.toml / package.json — except global-shortcut)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| tauri | 2.x | Desktop shell, webview management | Installed |
| @tauri-apps/api | 2.x | Frontend IPC (`invoke`, `listen`) | Installed |
| react | 18.x | Sidebar shell UI | Installed |
| typescript | 5.x | Type safety | Installed |
| tailwindcss | 4.x | Utility CSS | Installed |
| @tailwindcss/vite | 4.x | Tailwind v4 Vite integration | Installed |

### New for Phase 2

| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| tauri-plugin-global-shortcut | 2.x | Global Cmd+1–9, Cmd+B, Cmd+R shortcuts | `cargo add` + `npm install` |
| @tauri-apps/plugin-global-shortcut | 2.x | JS bindings (not needed for our Rust-only approach — skip) | Skip |

**Installation:**
```bash
# Rust
cargo add tauri-plugin-global-shortcut --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'

# JS bindings are NOT needed — all shortcuts handled in Rust
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rust global shortcut handler emitting event | JS `window.addEventListener('keydown')` | JS approach doesn't work — app webviews steal keyboard focus |
| `eval("location.reload()")` for Cmd+R | Dedicated `navigate(url)` call | eval is simpler; navigate re-creates history. Reload is the correct semantic |
| `GroupConfig.collapsed` persisted in apps.json | React `useState` + `localStorage` | apps.json is the single source of truth per architecture; localStorage introduces drift |

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 changes)

```
src/
├── App.tsx                    # Add sidebarCollapsed state, webview card styling
├── components/
│   ├── Sidebar.tsx            # REFACTOR: grouped sections, collapse, Arc styling
│   └── AppItem.tsx            # NEW (optional): extracted app row with favicon fallback
├── hooks/
│   └── useAppsConfig.ts       # EXTEND: lastActiveAppId, sidebarCollapsed, group collapse persist
└── types.ts                   # EXTEND: GroupConfig.collapsed, NexusConfig.sidebarCollapsed + lastActiveAppId

src-tauri/src/
├── lib.rs                     # ADD: global-shortcut plugin init + shortcut registration
├── commands/
│   ├── webview.rs             # ADD: reload_webview command
│   └── config.rs              # ADD: save_config command (persists collapsed state, lastActiveAppId)
└── config.rs                  # EXTEND: GroupConfig.collapsed, NexusConfig top-level fields
```

### Pattern 1: Global Shortcut Registration in Rust setup()

**What:** Install `tauri-plugin-global-shortcut` as a Builder plugin in `setup()`. Register all shortcuts with `GlobalShortcutExt::register`. For shortcuts that need frontend state changes (Cmd+B), emit a Tauri event. For shortcuts that map to existing Rust commands (Cmd+1–9, Cmd+R), call the logic directly in the handler.

**When to use:** Every keyboard shortcut in the app. Never register shortcuts in React.

**Critical macOS detail:** On macOS the Command key = `Modifiers::SUPER`. `CommandOrControl` as a string parses correctly too. Code enum values are `Code::Digit1` through `Code::Digit9`.

```rust
// Source: https://v2.tauri.app/plugin/global-shortcut/ + tauri-docs GitHub
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// In lib.rs setup():
app.handle().plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler({
            let app_handle = app.handle().clone();
            move |_app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                // Match on shortcut and dispatch
                // (see full example in Code Examples section)
            }
        })
        .build(),
)?;

// Register Cmd+1 through Cmd+9
let digit_codes = [
    Code::Digit1, Code::Digit2, Code::Digit3,
    Code::Digit4, Code::Digit5, Code::Digit6,
    Code::Digit7, Code::Digit8, Code::Digit9,
];
for code in digit_codes {
    let sc = Shortcut::new(Some(Modifiers::SUPER), code);
    app.global_shortcut().register(sc)?;
}
// Cmd+B
app.global_shortcut().register(
    Shortcut::new(Some(Modifiers::SUPER), Code::KeyB)
)?;
// Cmd+R
app.global_shortcut().register(
    Shortcut::new(Some(Modifiers::SUPER), Code::KeyR)
)?;
```

**Capabilities file addition:**
```json
// src-tauri/capabilities/default.json — add to "permissions":
"global-shortcut:allow-register",
"global-shortcut:allow-is-registered",
"global-shortcut:allow-unregister"
```

### Pattern 2: Cmd+R — Reload Active Webview

**What:** Rust shortcut handler reads `active_app_id` from `AppState`, looks up the webview by label, calls `.eval("location.reload()")`.

**Why eval:** There is no `.reload()` method on `WebviewWindow` in Tauri 2. Calling `eval("location.reload()")` is the documented approach. Confirmed from Tauri docs and community usage (HIGH confidence).

```rust
// In reload_webview command or shortcut handler:
fn reload_active_webview(app_handle: &AppHandle, state: &Mutex<AppState>) -> Result<(), String> {
    let active_id = {
        let st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id.clone()
    };
    if let Some(app_id) = active_id {
        let label = format!("app-{}", app_id);
        if let Some(webview) = app_handle.get_webview_window(&label) {
            webview.eval("location.reload()").map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

### Pattern 3: Cmd+B — Sidebar Toggle via Tauri Event

**What:** Rust handler emits `"sidebar-toggle"` event to the React shell. React listens with `listen()` and toggles `sidebarCollapsed` state. The new state is persisted back to `apps.json` via a `save_config` IPC call.

**Why event (not IPC invoke from Rust):** The sidebar toggle is a UI state change — Rust has no direct way to mutate React state. Emitting an event from Rust → React is the correct Tauri pattern for Rust-initiated UI changes.

```rust
// Rust handler snippet (inside with_handler closure):
use tauri::Emitter;
app_handle.emit("sidebar-toggle", ()).ok();
```

```typescript
// React — in useAppsConfig or App.tsx:
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
    const unlisten = listen('sidebar-toggle', () => {
        setSidebarCollapsed(prev => !prev);
    });
    return () => { unlisten.then(f => f()); };
}, []);
```

### Pattern 4: Schema Extension — New apps.json Fields

**What:** Three new fields added to the schema. All have serde defaults to maintain backward compatibility with existing apps.json files.

**Rust structs (config.rs):**
```rust
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct GroupConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]          // backward compat: missing = false
    pub collapsed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct NexusConfig {
    pub groups: Vec<GroupConfig>,
    pub apps: Vec<AppConfig>,
    #[serde(default)]          // backward compat: missing = null
    pub last_active_app_id: Option<String>,
    #[serde(default)]          // backward compat: missing = false
    pub sidebar_collapsed: bool,
}
```

**TypeScript types.ts:**
```typescript
export interface GroupConfig {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface NexusConfig {
  groups: GroupConfig[];
  apps: AppConfig[];
  last_active_app_id: string | null;
  sidebar_collapsed: boolean;
}
```

**JSON field naming:** serde renames `last_active_app_id` → `lastActiveAppId` and `sidebar_collapsed` → `sidebarCollapsed` in JSON by default if using `#[serde(rename_all = "camelCase")]` on the struct. Use camelCase in JSON to match existing convention.

### Pattern 5: Persisting UI State Back to apps.json

**What:** When user collapses a group or toggles the sidebar, the React hook calls `invoke("save_config", { config: updatedConfig })` to write the new state back to apps.json. The Rust `save_config` command receives the full `NexusConfig` and writes it to disk.

**Critical:** The file watcher has 300ms debounce — writing via `save_config` will trigger the watcher and invoke `reload_config`, creating a loop. Prevent this by tracking "self-writes" (either suppress the reload if config didn't actually change, or use a flag in AppState).

**Simplest loop prevention:** Compare the incoming `reload_config` result with current state — if equal, no-op the `setConfig` call in React.

```rust
#[tauri::command]
pub fn save_config(
    config: NexusConfig,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let path = config::config_path();
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    let mut locked = state.lock().map_err(|e| e.to_string())?;
    locked.config = config;
    Ok(())
}
```

### Pattern 6: Group Rendering in React

**What:** In `Sidebar.tsx`, group apps by their `group` field. For each group in `config.groups`, render a collapsible section. Apps whose `group` doesn't match any group ID go into an "Other" bucket rendered last with no header.

```typescript
// Grouping logic (pure, no side effects):
function groupApps(config: NexusConfig): Array<{
  group: GroupConfig | null; // null = "Other"
  apps: AppConfig[];
}> {
  const grouped = new Map<string, AppConfig[]>();
  const other: AppConfig[] = [];

  for (const app of config.apps) {
    const validGroup = config.groups.find(g => g.id === app.group);
    if (validGroup) {
      const list = grouped.get(app.group) ?? [];
      list.push(app);
      grouped.set(app.group, list);
    } else {
      other.push(app);
    }
  }

  const result = config.groups
    .filter(g => grouped.has(g.id))
    .map(g => ({ group: g, apps: grouped.get(g.id)! }));

  if (other.length > 0) {
    result.push({ group: null, apps: other });
  }

  return result;
}
```

### Pattern 7: Tailwind v4 Custom Color (Sidebar Background)

**What:** Sidebar background is #111117 — darker than Tailwind's `gray-900` (#111827). Define a custom CSS variable using Tailwind v4's `@theme` directive.

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-sidebar: #111117;
}
```

Then use `bg-sidebar` as a Tailwind class. No `tailwind.config.js` needed in v4.

### Pattern 8: Favicon Fallback (First Letter in Gray Circle)

**What:** `<img>` with `onError` handler. On error, swap to a `<span>` rendering the first letter of the app name.

```tsx
function AppIcon({ appUrl, appName }: { appUrl: string; appName: string }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getFaviconUrl(appUrl);

  if (failed || !faviconUrl) {
    return (
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center
                       rounded-full bg-white/10 text-[9px] font-medium text-gray-300">
        {appName[0]?.toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      width={16}
      height={16}
      className="flex-shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}
```

### Anti-Patterns to Avoid

- **Registering shortcuts in React (`useEffect` + `keydown`):** Webviews steal keyboard focus. All shortcuts MUST be in Rust.
- **Using `localStorage` for sidebar/group collapsed state:** apps.json is the single source of truth. Using localStorage creates drift when the file is edited externally.
- **Creating a reload IPC command that calls `navigate(url)` instead of `eval("location.reload()")`:** `navigate` resets browser history and may break session state. `location.reload()` is semantically correct.
- **Comparing shortcuts by reference in the `with_handler` closure:** The `shortcut` parameter is `&Shortcut`. Compare with `==` (PartialEq is implemented) or match on `shortcut.key` + `shortcut.mods` fields.
- **Writing to apps.json and immediately reading it back via the file watcher:** Creates a config-reload loop. Either debounce the reload (already done at 300ms) or compare config in `reload_config` before calling `setConfig`.
- **Rendering an "Other" group header:** Per decisions, "Other" has no header — apps render directly in the sidebar list without a group label.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global shortcuts | `CGEventTap` (macOS) or `RegisterHotKey` (Win) | `tauri-plugin-global-shortcut` | Cross-platform, handles macOS permissions, sandbox-aware |
| Webview reload | Custom navigation command | `webview_window.eval("location.reload()")` | No `.reload()` API exists; eval is the correct approach |
| Favicon fetch | HTML parsing of `<link rel="icon">` | `https://www.google.com/s2/favicons?domain=X&sz=32` | CDN-backed, instant, established pattern from Phase 1 |
| Group state sync | Custom state management library | `invoke("save_config")` + existing file watcher | IPC + file watcher already built; no new infrastructure needed |
| Sidebar toggle persistence | IndexedDB, SQLite, dedicated preferences file | `sidebarCollapsed` field in apps.json | Single file = single source of truth, simpler |

**Key insight:** All heavy lifting (IPC, file watching, webview management) is already built. Phase 2 is primarily CSS + React restructuring + one new Rust plugin.

---

## Common Pitfalls

### Pitfall 1: Shortcut Handler — ShortcutState::Released fires too

**What goes wrong:** The handler fires on BOTH key-down and key-up. Without filtering, every shortcut action executes twice.

**Why it happens:** `with_handler` receives all `ShortcutEvent`s including `ShortcutState::Released`.

**How to avoid:** Early return when `event.state() != ShortcutState::Pressed`.

**Warning signs:** Sidebar toggles on press and again on release (collapses then immediately re-expands).

### Pitfall 2: File Watcher Loop from save_config

**What goes wrong:** `save_config` writes apps.json → watcher fires → `reload_config` is called → `setConfig` runs → React re-renders → (if not idempotent, triggers another write).

**Why it happens:** The watcher has no knowledge of who wrote the file.

**How to avoid:** In the React `useEffect` watcher callback, compare the newly loaded config with the current config before calling `setConfig`. Because `save_config` also updates `AppState.config`, the `reload_config` result will equal the in-memory config — no-op the setState.

```typescript
// In useAppsConfig.ts watcher callback:
const updated = await invoke<NexusConfig>("reload_config");
setConfig(prev => {
    if (JSON.stringify(prev) === JSON.stringify(updated)) return prev; // no-op
    return updated;
});
```

**Warning signs:** Sidebar group collapsed state snaps back immediately after toggling.

### Pitfall 3: Cmd+1–9 Position is Global, Not Per-Group

**What goes wrong:** Developer maps Cmd+1 to the first app in the first group, Cmd+2 to the second app in the first group — but apps 5–9 in a multi-group sidebar become unreachable.

**Why it happens:** Per-group indexing seems natural given grouped sidebar display.

**How to avoid:** Use `config.apps[index]` (flat array position) for Cmd+N shortcuts. This is the locked decision.

**Warning signs:** Pressing Cmd+5 when groups are collapsed jumps to the wrong app.

### Pitfall 4: `GroupConfig.collapsed` Not Defaulting on Old apps.json

**What goes wrong:** User has an existing apps.json without `collapsed` fields. Serde fails to deserialize or sets collapsed to `null` in TypeScript.

**Why it happens:** Missing fields without `#[serde(default)]` cause deserialization failure.

**How to avoid:** Add `#[serde(default)]` to `collapsed` in `GroupConfig`. Default for `bool` is `false` = expanded. Also add `collapsed: false` to the TypeScript default when the field is absent.

**Warning signs:** All groups render collapsed on first launch after upgrading.

### Pitfall 5: Sidebar Toggle State Out of Sync Between Rust and React

**What goes wrong:** Rust emits `"sidebar-toggle"` event, React toggles its local state — but if the event is emitted before React has set up the listener, the toggle is lost.

**Why it happens:** React `useEffect` for `listen()` runs after the first render, but Tauri's `setup()` runs at app launch. Cmd+B pressed very early could fire before the listener is attached.

**How to avoid:** The shortcut cannot fire before the user interacts (macOS takes focus time). In practice, this is not a real issue for keyboard shortcuts. But to be safe, initialize `sidebarCollapsed` from `config.sidebar_collapsed` on load (not from the toggle event count).

**Warning signs:** After restarting the app with sidebar previously collapsed, the sidebar shows (React default) but webview is visible (Tauri state says collapsed).

### Pitfall 6: `Shortcut::new` with `Modifiers::SUPER` on macOS

**What goes wrong:** Developer uses `Modifiers::CONTROL` for "Command+1" on macOS — registers Ctrl+1 instead of Cmd+1.

**Why it happens:** macOS "Command" = `Modifiers::SUPER` (the Super modifier). `Modifiers::CONTROL` = the Control key, which is different on macOS.

**How to avoid:** Use `Modifiers::SUPER` for Cmd shortcuts on macOS. Since this app targets macOS in Phase 2, always use SUPER.

**Warning signs:** Pressing Cmd+1 does nothing; Ctrl+1 triggers the shortcut.

---

## Code Examples

### Complete Global Shortcut Setup (lib.rs)

```rust
// Source: https://v2.tauri.app/plugin/global-shortcut/ (verified)
use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Inside setup() closure:
let app_handle_sc = app.handle().clone();
let state_sc = app.state::<std::sync::Mutex<AppState>>();

app.handle().plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |_app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }

            // Cmd+B → sidebar toggle
            if shortcut.mods == Some(Modifiers::SUPER) && shortcut.key == Code::KeyB {
                app_handle_sc.emit("sidebar-toggle", ()).ok();
                return;
            }

            // Cmd+R → reload active webview
            if shortcut.mods == Some(Modifiers::SUPER) && shortcut.key == Code::KeyR {
                if let Ok(st) = app_handle_sc.state::<std::sync::Mutex<crate::state::AppState>>().lock() {
                    if let Some(ref app_id) = st.active_app_id {
                        let label = format!("app-{}", app_id);
                        if let Some(wv) = app_handle_sc.get_webview_window(&label) {
                            let _ = wv.eval("location.reload()");
                        }
                    }
                }
                return;
            }

            // Cmd+1 through Cmd+9 → switch to app by position
            let digit_codes = [
                Code::Digit1, Code::Digit2, Code::Digit3,
                Code::Digit4, Code::Digit5, Code::Digit6,
                Code::Digit7, Code::Digit8, Code::Digit9,
            ];
            if let Some(pos) = digit_codes.iter().position(|c| *c == shortcut.key) {
                if shortcut.mods == Some(Modifiers::SUPER) {
                    let st = app_handle_sc.state::<std::sync::Mutex<crate::state::AppState>>();
                    if let Ok(locked) = st.lock() {
                        if let Some(app) = locked.config.apps.get(pos) {
                            let app_id = app.id.clone();
                            drop(locked);
                            // Call switch_app logic directly
                            let _ = crate::commands::webview::switch_app_by_id(
                                app_id, &app_handle_sc, &st
                            );
                        }
                    }
                }
            }
        })
        .build(),
)?;

// Register all shortcuts
let digit_codes = [
    Code::Digit1, Code::Digit2, Code::Digit3,
    Code::Digit4, Code::Digit5, Code::Digit6,
    Code::Digit7, Code::Digit8, Code::Digit9,
];
for code in digit_codes {
    app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER), code))?;
}
app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER), Code::KeyB))?;
app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER), Code::KeyR))?;
```

**Note on `switch_app` from handler:** The existing `switch_app` IPC command takes `State<'_, Mutex<AppState>>` which requires Tauri's injection — can't call it directly from a closure. The planner should extract the core logic into a free function `switch_app_by_id(app_id, app_handle, state)` that both the IPC command and the shortcut handler can call.

### Sidebar Component Skeleton (Arc Aesthetic)

```tsx
// src/components/Sidebar.tsx
// Monochromatic dark — no accent colors
export function Sidebar({ config, activeAppId, onSwitch, onGroupToggle }: SidebarProps) {
  const groups = groupApps(config);

  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col bg-sidebar">
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map(({ group, apps }) => (
          <div key={group?.id ?? '__other'} className="mb-1">
            {group && (
              <button
                onClick={() => onGroupToggle(group.id)}
                className="flex w-full items-center gap-1.5 px-2 py-1
                           text-[10px] font-semibold uppercase tracking-widest
                           text-gray-500 hover:text-gray-400"
              >
                <ChevronIcon
                  className={`h-3 w-3 transition-transform ${group.collapsed ? '-rotate-90' : ''}`}
                />
                {group.name}
              </button>
            )}
            {!group?.collapsed && (
              <ul className="space-y-0.5">
                {apps.map(app => (
                  <AppRow
                    key={app.id}
                    app={app}
                    isActive={app.id === activeAppId}
                    onClick={() => onSwitch(app.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

### App.tsx Layout with Webview Card

```tsx
// Webview card: rounded corners + visible gap on all sides
// The gap + bg-gray-950 window bg creates the "floating card" Arc look
<div className="flex h-screen overflow-hidden bg-gray-950">
  {!sidebarCollapsed && (
    <Sidebar ... />
  )}
  <main className="flex flex-1 p-2">
    {/* p-2 creates the gap; the main area is bg-gray-950 */}
    {activeAppId ? (
      <div className="flex-1 overflow-hidden rounded-lg bg-gray-900">
        {/* webviews are native OS windows — this div just shows the visual frame */}
      </div>
    ) : (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-600">
        Select an app
      </div>
    )}
  </main>
</div>
```

**Note on webview positioning:** The native `WebviewWindow` created by Tauri is a separate OS window, not a DOM element. The React shell's "card" div is a visual cue only — the actual webview window must be positioned to fill the same region using `webview_window.set_position()` and `set_size()`. This is the most complex part of VIS-04. See the Webview Positioning section below.

### Webview Card Positioning (Critical Detail)

The webview windows are **native OS windows**, not React components. To achieve the "floating card" look, the webview window must be repositioned and resized to match the card area whenever:
- The sidebar is toggled (Cmd+B)
- The window is resized

**Approach:** After `switch_app` creates or shows a webview, immediately call `set_position` and `set_size` to match the main content area (accounting for sidebar width and the gap/padding).

```rust
// After building the WebviewWindow, position it:
use tauri::LogicalPosition;
use tauri::LogicalSize;

const SIDEBAR_WIDTH: u32 = 220;
const GAP: u32 = 8; // 2 * 4px (p-2 = 8px in Tailwind)
const BORDER_RADIUS: u32 = 8; // visual only — can't apply border-radius to OS window

// Get main window size
let main_window = app_handle.get_webview_window("main").unwrap();
let outer_size = main_window.outer_size()?;

let x = if sidebar_collapsed { GAP } else { SIDEBAR_WIDTH + GAP };
let y = GAP;
let width = outer_size.width - x - GAP;
let height = outer_size.height - (GAP * 2);

webview_window.set_position(LogicalPosition::new(x, y))?;
webview_window.set_size(LogicalSize::new(width, height))?;
```

**Alternative (simpler but less Arc-like):** Skip the gap entirely — webview fills the entire right side. This avoids the positioning complexity but loses the floating card aesthetic. Given the strong decision for Arc look, the gap approach is correct.

**The border-radius limitation:** OS windows cannot have rounded corners via Tauri API. The visual `rounded-lg` effect from the React shell's card div is behind the webview window, not on it. The webview clips the rounded corners. To work around: leave a small gap so the dark background shows, making the webview appear as a slightly inset rectangle. On macOS, native windows can have a visual "inner shadow" via `window.setHasShadow(false)` + `decorations(false)` — but this is optional polish. The gap itself is the primary Arc visual cue.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `globalShortcut.register()` JS API | Rust `tauri_plugin_global_shortcut::Builder::with_handler` | Tauri 2.0 (Oct 2024) | Plugin-based, must be installed separately |
| `Modifiers::META` for Cmd key | `Modifiers::SUPER` | global-hotkey crate naming | Using META won't compile |
| Tailwind `gray-900` class for dark bg | Custom `@theme` CSS variable for non-standard colors | Tailwind v4 (Jan 2025) | No config file needed, just CSS |
| Separate `window.location.reload()` IPC | `webview_window.eval("location.reload()")` directly | Always been this way in Tauri 2 | No dedicated `.reload()` API exists |

**Deprecated/outdated:**
- `tauri::api::global_shortcut` (Tauri v1): Does not exist in Tauri 2 — replaced by plugin
- Registering shortcuts in React `keydown` handlers: Never worked for app webviews, confirmed pitfall

---

## Open Questions

1. **Webview window positioning when main window is resized**
   - What we know: `WebviewWindow::set_position` and `set_size` work. Main window emits `tauri://resize` event.
   - What's unclear: Does the shell need to listen for `tauri://resize` and reposition all webviews? Or can we constrain the main shell window to not be resizable in Phase 2?
   - Recommendation: Lock main window resize in Phase 2 (simplest). Add resize handler in Phase 4 if needed. Set `"resizable": false` in `tauri.conf.json` for now.

2. **Shortcut conflict with macOS system shortcuts**
   - What we know: Cmd+R is used by macOS in some contexts (rotate in Photos, etc.). Cmd+B is bold in text editors.
   - What's unclear: Will macOS intercept Cmd+R before Tauri when a webview has focus?
   - Recommendation: `tauri-plugin-global-shortcut` registers at the OS level (like system-wide hotkeys), so it should receive events before app-level handlers. Validate during manual testing.

3. **Cmd+1–9 shortcut extraction: IPC command vs direct Rust call**
   - What we know: The existing `switch_app` is a `#[tauri::command]` that requires `State<>` injection — cannot call directly from handler closure.
   - What's unclear: Best refactoring approach — shared function vs invoking the command via `app_handle.invoke`.
   - Recommendation: Extract core `switch_app` logic into `pub fn switch_app_impl(app_id, &AppHandle, &Mutex<AppState>)` callable from both IPC and shortcut handler. Clean separation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + Rust `#[cfg(test)]` (backend) |
| Config file | `vite.config.ts` inline `test:{}` block — not yet added |
| Quick run command | `cargo test -p nexus && pnpm vitest run --reporter=dot` |
| Full suite command | `cargo test -p nexus && pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Sidebar renders grouped apps | unit (React) | `pnpm vitest run src/__tests__/Sidebar.test.tsx` | ❌ Wave 0 |
| NAV-03 | `groupApps()` puts ungrouped apps in "Other" | unit (TS) | `pnpm vitest run src/__tests__/groupApps.test.ts` | ❌ Wave 0 |
| NAV-03 | `groupApps()` preserves group order from config | unit (TS) | same file | ❌ Wave 0 |
| NAV-05 | Active app gets `bg-white/10` class | unit (React) | `pnpm vitest run src/__tests__/Sidebar.test.tsx` | ❌ Wave 0 |
| NAV-02 | `save_config` persists `sidebarCollapsed` field | unit (Rust) | `cargo test -p nexus -- config::save` | ❌ Wave 0 |
| NAV-03 | `GroupConfig.collapsed` defaults to false with `#[serde(default)]` | unit (Rust) | `cargo test -p nexus -- config::group_collapsed_default` | ❌ Wave 0 |
| KEY-01 | Cmd+1 jumps to `config.apps[0]` | manual-only | — | N/A (requires runtime) |
| KEY-02 | Cmd+R reloads active webview | manual-only | — | N/A (requires webview) |
| KEY-03 | Cmd+B toggles sidebar | manual-only | — | N/A (requires runtime) |
| WEB-08 | `eval("location.reload()")` triggers on active webview | manual-only | — | N/A (requires webview) |
| VIS-01 | Sidebar background renders with custom color | manual-only | — | N/A (requires visual inspection) |
| VIS-04 | Sidebar collapsed → main fills full width | unit (React) | `pnpm vitest run src/__tests__/App.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cargo test -p nexus && pnpm vitest run --reporter=dot`
- **Per wave merge:** `cargo test -p nexus && pnpm vitest run`
- **Phase gate:** Full suite green + manual smoke test of all 5 success criteria before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/Sidebar.test.tsx` — covers NAV-01, NAV-05, VIS-04 rendering
- [ ] `src/__tests__/groupApps.test.ts` — covers NAV-03 grouping logic
- [ ] `src/__tests__/App.test.tsx` — covers VIS-04 sidebar collapsed layout
- [ ] `vitest.config.ts` or `vite.config.ts` `test:{}` block — frontend test runner setup
- [ ] Rust: `#[cfg(test)]` block in `config.rs` for `GroupConfig.collapsed` serde default
- [ ] Rust: `#[cfg(test)]` block in `commands/config.rs` for `save_config` round-trip

---

## Sources

### Primary (HIGH confidence)
- [Tauri Global Shortcut Plugin docs](https://v2.tauri.app/plugin/global-shortcut/) — plugin setup, `with_handler`, `register()`, permissions
- [tauri-plugin-global-shortcut GitHub (tauri-docs)](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/global-shortcut.mdx) — Rust code examples, `Modifiers::SUPER`, `Code::Digit1`
- [Tauri Calling Frontend docs](https://v2.tauri.app/develop/calling-frontend/) — `app.emit()` event pattern, `Emitter` trait
- [Tauri WebviewWindow Rust docs](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindow.html) — `eval()`, `set_position()`, `set_size()`, `show()`, `hide()`
- Phase 1 RESEARCH.md — established patterns (IPC, file watcher, config struct)
- Codebase inspection (2026-03-19) — `Sidebar.tsx`, `useAppsConfig.ts`, `App.tsx`, `types.ts`, `config.rs`, `state.rs`, `commands/webview.rs`, `lib.rs`

### Secondary (MEDIUM confidence)
- [Tauri Global Shortcut Plugin — crates.io](https://crates.io/crates/tauri-plugin-global-shortcut) — version 2.3.1 confirmed current
- [Tauri Discussion #7121](https://github.com/orgs/tauri-apps/discussions/7121) — valid keys/modifiers documentation, `Modifiers::SUPER` confirmed for macOS Cmd
- [WebSearch: tauri 2 WebviewWindow eval location.reload 2025](https://v2.tauri.app/develop/calling-frontend/) — `eval("location.reload()")` as the correct reload approach

### Tertiary (LOW confidence)
- WebSearch result for `on_shortcuts` batch registration API — may not exist in current version; verified `register()` per-shortcut loop approach instead.

---

## Metadata

**Confidence breakdown:**
- Global shortcut Rust API (`Modifiers::SUPER`, `Code::Digit1`, `with_handler`): HIGH — verified against official docs and crates.io version
- Webview reload via `eval("location.reload()")`: HIGH — confirmed no `.reload()` method exists, eval is the documented approach
- `sidebarCollapsed`/`lastActiveAppId` persistence in apps.json: HIGH — pattern consistent with existing config architecture
- Webview card positioning (`set_position`/`set_size`): MEDIUM — API confirmed in Rust docs; exact coordinates depend on runtime window size
- File watcher loop prevention: MEDIUM — debounce already works at 300ms; comparison approach is standard React pattern

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (Tauri plugin APIs move fast; verify global-shortcut plugin version before executing)

# Phase 3: Command Palette & Config Management - Research

**Researched:** 2026-03-19
**Domain:** React command palette overlay + dnd-kit drag & drop + Tauri 2 native context menu + macOS menu bar
**Confidence:** HIGH (all key APIs verified against official docs and codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Command Palette style:** Spotlight-style overlay, centered top of window, dimmed background. Text mode = fuzzy search to switch apps. `>` prefix = action mode (Add new app, Remove current app, Reload page, Toggle sidebar).
- **Palette navigation:** Arrow keys + Enter to select. Tab to autocomplete. Escape / click-outside closes. Opens with Cmd+K (registered in Rust, same pattern as Cmd+B/R).
- **Add app flow:** Fields = URL + name only. Group assigned later (defaults to "Other"). ID auto-generated from name. Inline mini form inside the palette (palette morphs to form when "Add new app" selected).
- **Add app persistence:** `save_config` IPC immediately. App appears in sidebar right away.
- **Remove app:** Two paths — right-click sidebar → "Remove" OR palette action `> Remove [app name]`. No confirmation. If active app is removed: close its webview and show empty state.
- **Sidebar context menu:** Native macOS (Tauri Menu API), NOT CSS custom. Options: Open, Reload, (separator), Edit..., Remove.
- **Edit...:** Opens inline form (same palette mini-form reused) to change name/URL.
- **Drag & drop:** Apps draggable between groups AND groups reorderable by dragging group header. Visual indicator: horizontal line between items + dragged item at 50% opacity. Changes persist immediately via `save_config`.
- **Menu bar:** Minimal native macOS. Nexus (About, Quit), File (Add App Cmd+N), View (Toggle Sidebar Cmd+B, Reload Cmd+R). Purpose: shortcut documentation in system menu.
- **Cmd+K:** Global shortcut registered in Rust (same pattern as existing shortcuts in lib.rs).

### Claude's Discretion
- Fuzzy search library (fuse.js or similar).
- Drag & drop library (dnd-kit, react-beautiful-dnd, or native HTML5).
- Exact styling of command palette overlay (width, border-radius, shadow).
- How to implement "Edit..." form (inline in palette vs mini popover) — locked as "inline in palette" but exact React state machine is discretion.
- Tauri Menu API specifics for context menus (JS vs Rust side).

### Deferred Ideas (OUT OF SCOPE)
- Personalizable preferences (border-radius, bg color, gap) — new phase.
- Sidebar toggle button at bottom (Arc style) — new phase.
- Settings button in sidebar — new phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | Cmd+K opens command palette overlay | Global shortcut in Rust (existing pattern) + React overlay component |
| CMD-02 | Fuzzy search across all app names to switch | fuse.js v7 with `keys: ['name']` + filtered list with keyboard navigation |
| CMD-03 | Add new app URL from command palette | Inline mini form state in palette + `save_config` IPC + `reload_config` via file watcher |
| CMD-04 | Quick actions: reload, remove app from palette | Action mode with `>` prefix, two sub-actions: reload active (`eval("location.reload()")`), remove (destroy webview + save_config) |
| CONF-02 | Add new app from within the app | CMD-03 covers this |
| CONF-03 | Remove app from within the app | Right-click context menu (Tauri Menu API JS side) + palette action |
| CONF-05 | Drag & drop reorder persists to apps.json | dnd-kit @dnd-kit/sortable + save_config on drag end |
| NAV-06 | Drag and drop apps to reorder in sidebar | dnd-kit SortableContext wrapping sidebar app list |
</phase_requirements>

---

## Summary

Phase 3 has four independent technical areas: (1) command palette React component with dual mode (fuzzy search + action prefix), (2) dnd-kit drag-and-drop reorder for sidebar items and groups, (3) native macOS context menus via Tauri Menu API (JavaScript side), and (4) native macOS menu bar via Tauri MenuBuilder (Rust side).

All infrastructure is already in place: `save_config` IPC exists, `switch_app_impl` is a public Rust function callable from anywhere, the global shortcut registration pattern is established in `lib.rs`, and `useAppsConfig` can be extended with `addApp`, `removeApp`, and `reorderApps` mutations. No new Rust IPC commands are needed for add/remove — they go through the existing `save_config`. The only new Rust code is: (a) register Cmd+K shortcut in `lib.rs`, (b) add webview cleanup logic when removing an active app, (c) native menu bar with `MenuBuilder`.

The context menu is best done from the JavaScript side using `@tauri-apps/api/menu` (`Menu`, `MenuItem`) called from a React `onContextMenu` handler — this avoids complex Rust-to-frontend round trips for knowing which app was right-clicked.

**Primary recommendation:** Use fuse.js v7 for fuzzy search (4 kB gzipped, zero dependencies, widely used) and `@dnd-kit/sortable` for drag-and-drop (10 kB gzipped, accessible, actively maintained, supports cross-group dragging with custom collision detection). Context menu: JS-side `@tauri-apps/api/menu` with `popup()` called from `onContextMenu`. Menu bar: Rust `MenuBuilder` in `setup()`.

---

## Standard Stack

### New dependencies for Phase 3

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fuse.js | 7.1.0 | Fuzzy search for command palette | Zero-dependency, 4 kB gzipped, battle-tested in Spotlight-like UIs |
| @dnd-kit/core | ^6 | Drag & drop primitives | Modern, accessible, 10 kB, actively maintained in 2025 |
| @dnd-kit/sortable | ^8 | Sortable list preset (arrayMove, useSortable) | Directly maps to our vertical list reorder use case |
| @dnd-kit/utilities | ^3 | CSS.Transform utility for useSortable | Required companion for useSortable transform styles |
| @tauri-apps/api/menu | (bundled in @tauri-apps/api 2.x) | Native macOS context menu popup | Official Tauri v2 JS API — no extra install needed |

### Already installed (no action needed)

| Library | Status | Phase 3 use |
|---------|--------|------------|
| @tauri-apps/api | Installed | `invoke`, `listen`, `Menu`, `MenuItem` |
| tauri-plugin-global-shortcut | Installed (lib.rs) | Add Cmd+K |
| tailwindcss v4 | Installed | Palette overlay styling |
| react 18 | Installed | All new components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fuse.js | minisearch, uFuzzy | fuse.js is simpler API, widely documented for palette UIs; uFuzzy is faster but more complex config |
| @dnd-kit/sortable | react-beautiful-dnd | react-beautiful-dnd is officially deprecated (not maintained); dnd-kit is the successor |
| @dnd-kit/sortable | Native HTML5 drag/drop | HTML5 DnD has poor mobile support, no animation, and complex cross-group logic — not worth it |
| JS-side context menu | Rust-side Tauri menu popup | Rust side requires knowing which app was clicked via an extra IPC round-trip; JS side has direct access to the clicked element and app id |

**Installation:**
```bash
npm install fuse.js @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
├── App.tsx                         # Add palette open state, Cmd+K listener
├── components/
│   ├── Sidebar.tsx                 # EXTEND: onContextMenu, DnD wrappers
│   ├── CommandPalette.tsx          # NEW: overlay with fuzzy search + action mode
│   └── AppIcon.tsx                 # UNCHANGED
├── hooks/
│   └── useAppsConfig.ts            # EXTEND: addApp, removeApp, reorderApps, reorderGroups
└── types.ts                        # UNCHANGED (schema is complete)

src-tauri/src/
├── lib.rs                          # ADD: Cmd+K shortcut + MenuBuilder for menu bar
├── commands/
│   ├── config.rs                   # UNCHANGED (save_config already handles all mutations)
│   └── webview.rs                  # EXTEND: destroy_webview for remove-active-app case
└── config.rs                       # UNCHANGED
```

### Pattern 1: Command Palette — Dual Mode State Machine

**What:** The palette has three states: `search` (default, fuzzy filter apps), `action` (when input starts with `>`), and `add-form` (when "Add new app" is selected from action mode).

**When to use:** All command palette logic lives in `CommandPalette.tsx`. Parent `App.tsx` only knows `isOpen` / `onClose`.

```typescript
// CommandPalette.tsx — internal state
type PaletteMode = 'search' | 'action' | 'add-form';

function CommandPalette({ isOpen, onClose, config, onSwitch, onAdd, onRemove }) {
  const [mode, setMode] = useState<PaletteMode>('search');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived: items to render based on mode
  const items = useMemo(() => {
    if (mode === 'action') return ACTIONS; // static list
    if (mode === 'search') return fuzzySearchApps(config.apps, query);
    return []; // add-form shows the form, not a list
  }, [mode, query, config.apps]);

  function handleInput(value: string) {
    if (value.startsWith('>')) {
      setMode('action');
      setQuery(value.slice(1).trimStart());
    } else {
      setMode('search');
      setQuery(value);
    }
    setSelectedIndex(0);
  }

  // Keyboard nav
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    if (e.key === 'ArrowUp') setSelectedIndex(i => Math.max(i - 1, 0));
    if (e.key === 'Enter') handleSelect(items[selectedIndex]);
  }
  // ...
}
```

**Palette overlay positioning (Spotlight-style):**
```tsx
// Centered top, fixed position over everything
<div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
     style={{ background: 'rgba(0,0,0,0.4)' }}
     onClick={onClose}>
  <div className="w-[560px] rounded-xl bg-[#1c1c21] shadow-2xl ring-1 ring-white/10"
       onClick={e => e.stopPropagation()}>
    <input ref={inputRef} ... />
    {/* results list */}
  </div>
</div>
```

### Pattern 2: Fuzzy Search with fuse.js

**What:** Create a `Fuse` instance from the apps array. Search by `name` field. Threshold 0.4 gives Spotlight-like tolerance.

```typescript
// Source: https://www.fusejs.io/
import Fuse from 'fuse.js';

function fuzzySearchApps(apps: AppConfig[], query: string): AppConfig[] {
  if (!query.trim()) return apps; // empty query = show all
  const fuse = new Fuse(apps, {
    keys: ['name'],
    threshold: 0.4,     // 0 = exact, 1 = match anything
    includeScore: false,
  });
  return fuse.search(query).map(r => r.item);
}
```

**Performance note:** For < 50 apps, creating `Fuse` per keystroke is fine (< 1ms). No memoization needed.

**Action mode items (static):**
```typescript
const ACTIONS = [
  { id: 'add-app', label: 'Add new app', icon: '+' },
  { id: 'remove-app', label: 'Remove current app', icon: '−' },
  { id: 'reload-app', label: 'Reload page', icon: '↺' },
  { id: 'toggle-sidebar', label: 'Toggle sidebar', icon: '⇥' },
];
```

### Pattern 3: Add App — Inline Form in Palette

**What:** When user selects "Add new app", the palette input area morphs into a 2-field mini form (URL first, then name). On submit: generate ID from name, assign group "other", call `addApp`.

```typescript
// In useAppsConfig — new mutation:
async function addApp(name: string, url: string): Promise<void> {
  if (!config) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const newApp: AppConfig = { id, name, url, group: '' }; // empty = "Other" bucket
  const updated: NexusConfig = { ...config, apps: [...config.apps, newApp] };
  await invoke('save_config', { config: updated });
  setConfig(updated);
}
```

**ID collision guard:** If `id` already exists in `config.apps`, append a suffix (`-2`, `-3`, etc.) or use `crypto.randomUUID().slice(0, 8)` as fallback.

### Pattern 4: Remove App — Webview Cleanup

**What:** Remove from config, save, and if the app was active: destroy its child webview and show empty state.

```typescript
// In useAppsConfig — new mutation:
async function removeApp(appId: string): Promise<void> {
  if (!config) return;
  const updated: NexusConfig = {
    ...config,
    apps: config.apps.filter(a => a.id !== appId),
    lastActiveAppId: config.lastActiveAppId === appId ? null : config.lastActiveAppId,
  };
  await invoke('save_config', { config: updated });
  setConfig(updated);

  if (activeAppId === appId) {
    // Tell Rust to destroy the webview for this app
    await invoke('destroy_webview', { appId });
    setActiveAppId(null);
  }
}
```

**New Rust command needed — `destroy_webview`:**
```rust
// In commands/webview.rs:
#[tauri::command]
pub fn destroy_webview(
    app_id: String,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let label = format!("app-{}", app_id);
    if let Some(wv) = app_handle.get_webview(&label) {
        wv.close().map_err(|e| e.to_string())?;
    }
    let mut st = state.lock().map_err(|e| e.to_string())?;
    st.webviews_created.remove(&app_id);
    if st.active_app_id.as_deref() == Some(&app_id) {
        st.active_app_id = None;
    }
    Ok(())
}
```

### Pattern 5: Native Context Menu (JS side via Tauri Menu API)

**What:** Listen for `contextmenu` on sidebar app items. Create a native menu and call `popup()`. Handle `action` callbacks directly in JS.

**Source:** Official Tauri v2 JS API docs + React example (https://github.com/crutchcorn/tauri-app-menu-example)

```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacemenu/
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';

async function showAppContextMenu(
  app: AppConfig,
  onOpen: () => void,
  onReload: () => void,
  onEdit: () => void,
  onRemove: () => void,
) {
  const menu = await Menu.new({
    items: [
      await MenuItem.new({ text: 'Open', action: onOpen }),
      await MenuItem.new({ text: 'Reload', action: onReload }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({ text: 'Edit...', action: onEdit }),
      await MenuItem.new({ text: 'Remove', action: onRemove }),
    ],
  });
  await menu.popup();
}
```

**In Sidebar.tsx:**
```tsx
<button
  onContextMenu={async (e) => {
    e.preventDefault();
    await showAppContextMenu(
      app,
      () => switchApp(app.id),
      () => invoke('reload_webview', { appId: app.id }),
      () => openEditForm(app),
      () => removeApp(app.id),
    );
  }}
  ...
>
```

**Capabilities required (add to default.json):**
```json
"menu:allow-new",
"menu:allow-append",
"menu:allow-popup"
```

### Pattern 6: Drag & Drop with dnd-kit

**What:** Wrap sidebar groups and apps with `DndContext` + nested `SortableContext`s. Support drag of apps between groups by using a flat ID space and custom collision detection.

**Source:** https://docs.dndkit.com/presets/sortable

**Packages:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Key insight for cross-group drag:** dnd-kit supports multiple `SortableContext`s under one `DndContext`. When `onDragEnd` fires, compute which group the item was dropped into based on the `over.id` and update config accordingly.

```typescript
// Simplified drag end handler in Sidebar.tsx or App.tsx:
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const activeAppId = active.id as string;
  const overId = over.id as string;

  // Determine if dragging over an app or a group header
  const overIsGroup = config.groups.some(g => g.id === overId);
  const overApp = config.apps.find(a => a.id === overId);

  const updatedApps = [...config.apps];
  const activeIdx = updatedApps.findIndex(a => a.id === activeAppId);

  if (overIsGroup) {
    // Drop onto group header → move to first position in that group
    updatedApps[activeIdx] = { ...updatedApps[activeIdx], group: overId };
  } else if (overApp) {
    // Drop onto another app → reorder + potentially change group
    updatedApps[activeIdx] = { ...updatedApps[activeIdx], group: overApp.group };
    const overIdx = updatedApps.findIndex(a => a.id === overId);
    const reordered = arrayMove(updatedApps, activeIdx, overIdx);
    reorderApps(reordered); // calls save_config
    return;
  }

  reorderApps(updatedApps);
}
```

**Visual drag indicator — drag overlay:**
```tsx
import { DragOverlay } from '@dnd-kit/core';

// Inside DndContext:
<DragOverlay>
  {activeId ? (
    <AppRow app={config.apps.find(a => a.id === activeId)!}
            style={{ opacity: 0.5 }} // 50% opacity per decision
            isActive={false}
            onClick={() => {}} />
  ) : null}
</DragOverlay>
```

**Line indicator:** Use `@dnd-kit/core`'s `over` state in `onDragOver` to track insertion point; render a `1px bg-white/30` absolute-positioned line between the hovered item and its neighbor.

### Pattern 7: Menu Bar (Rust, MacOS native)

**What:** Native macOS menu bar defined in Rust `setup()` with `MenuBuilder` and `SubmenuBuilder`. On macOS, the first submenu is automatically the app menu ("Nexus").

**Source:** https://v2.tauri.app/learn/window-menu/

```rust
// In lib.rs setup(), before plugin registration:
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder};

let nexus_menu = SubmenuBuilder::new(app, "Nexus")
    .text("about", "About Nexus")
    .separator()
    .text("quit", "Quit Nexus")
    .build()?;

let file_menu = SubmenuBuilder::new(app, "File")
    .text("add-app", "Add App")  // Cmd+N documented here
    .build()?;

let view_menu = SubmenuBuilder::new(app, "View")
    .text("toggle-sidebar", "Toggle Sidebar")
    .text("reload-page", "Reload Page")
    .build()?;

let menu = MenuBuilder::new(app)
    .items(&[&nexus_menu, &file_menu, &view_menu])
    .build()?;

app.set_menu(menu)?;

app.on_menu_event(move |app_handle, event| {
    match event.id().0.as_str() {
        "quit" => app_handle.exit(0),
        "add-app" => {
            // Emit event to frontend to open command palette in add-form mode
            if let Some(main_wv) = app_handle.get_webview("main") {
                let _ = main_wv.eval("window.dispatchEvent(new CustomEvent('open-add-app'))");
            }
        }
        "toggle-sidebar" => {
            if let Some(main_wv) = app_handle.get_webview("main") {
                let _ = main_wv.eval("window.dispatchEvent(new CustomEvent('sidebar-toggle'))");
            }
        }
        "reload-page" => {
            let state = app_handle.state::<std::sync::Mutex<crate::state::AppState>>();
            if let Ok(st) = state.lock() {
                if let Some(ref app_id) = st.active_app_id {
                    let label = format!("app-{}", app_id);
                    if let Some(wv) = app_handle.get_webview(&label) {
                        let _ = wv.eval("location.reload()");
                    }
                }
            }
        }
        _ => {}
    }
});
```

**Note on accelerators in menu bar items:** macOS shows shortcuts in the menu bar. To show Cmd+N next to "Add App", use `MenuItemBuilder` with `.accelerator("CmdOrCtrl+N")`. However, the actual shortcut action is triggered by the global shortcut registration, not the menu — the menu entry is for documentation only. Alternatively, register Cmd+N as a global shortcut in the same pattern as Cmd+B.

### Pattern 8: Cmd+K — Open Palette from Rust

**What:** Register Cmd+K global shortcut in Rust. Emit `open-palette` CustomEvent to React shell. React listens in `useAppsConfig` or `App.tsx`.

```rust
// In lib.rs shortcut handler (same with_handler closure as existing shortcuts):
if shortcut.key == Code::KeyK && shortcut.mods == Modifiers::SUPER {
    if let Some(main_wv) = app_handle_sc.get_webview("main") {
        let _ = main_wv.eval("window.dispatchEvent(new CustomEvent('open-palette'))");
    }
    return;
}
// Registration (same block as Cmd+B/R):
app.global_shortcut()
    .register(Shortcut::new(Some(Modifiers::SUPER), Code::KeyK))?;
```

```typescript
// In App.tsx or useAppsConfig:
function handleOpenPalette() {
  setIsPaletteOpen(true);
}
window.addEventListener('open-palette', handleOpenPalette);
```

### Pattern 9: reorderApps / reorderGroups Mutations in useAppsConfig

```typescript
// New mutations in useAppsConfig:
async function reorderApps(newAppsArray: AppConfig[]): Promise<void> {
  if (!config) return;
  const updated = { ...config, apps: newAppsArray };
  await invoke('save_config', { config: updated });
  setConfig(updated);
}

async function reorderGroups(newGroupsArray: GroupConfig[]): Promise<void> {
  if (!config) return;
  const updated = { ...config, groups: newGroupsArray };
  await invoke('save_config', { config: updated });
  setConfig(updated);
}
```

### Anti-Patterns to Avoid

- **Using `tauri::Emitter` for context menu item clicks:** Rust-side context menus require the Rust backend to know which app was right-clicked, requiring an extra IPC round-trip. JS-side context menus are simpler.
- **Creating `Fuse` instance outside the search function (at module level):** The apps array changes when apps are added/removed. Recreating `Fuse` per search is negligible overhead for < 50 items.
- **Mutating `config.apps` in place before calling `save_config`:** Always create a new object (`{ ...config, apps: newApps }`) to avoid React stale closure bugs.
- **Using `react-beautiful-dnd`:** Officially deprecated as of 2023. Use `@dnd-kit/sortable` instead.
- **Registering the menu bar before the `setup()` state is managed:** `app.set_menu()` should be called after `app.manage(Mutex::new(AppState::new(config)))`.
- **Forgetting to add `menu:allow-popup` to capabilities:** Context menu `popup()` fails silently without this permission.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search | Substring matching or Levenshtein distance | `fuse.js` v7 | Bitap algorithm handles typos, transpositions, and prefix matching correctly |
| Drag & drop | Mouse/pointer event tracking + DOM positioning | `@dnd-kit/sortable` | Accessibility, scroll containers, multi-list, animation — hundreds of edge cases |
| Cross-group DnD | Custom collision detection | `@dnd-kit/core` collision detection + `arrayMove` | dnd-kit's collision algorithms handle overlapping droppables correctly |
| Native context menu | CSS `<ul>` positioned at cursor | `@tauri-apps/api/menu` `Menu.popup()` | macOS system look, accessible, no z-index/overflow battles |
| ID generation for new apps | UUID library | `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` + UUID fallback | Simple, readable IDs; `uuid` package already in Cargo.toml for Rust if needed |

**Key insight:** The config mutation layer (`addApp`, `removeApp`, `reorderApps`) is just data transformation + existing `save_config` IPC. No new backend infrastructure needed.

---

## Common Pitfalls

### Pitfall 1: File Watcher Loop on save_config (already known, but now more frequent)

**What goes wrong:** Phase 3 adds 4 new mutation paths (add, remove, reorder apps, reorder groups). Each calls `save_config` → triggers file watcher → `reload_config` → `setConfig`. If the comparison logic in the watcher callback is not in place, the UI flickers or re-renders unnecessarily.

**Why it happens:** The existing watcher in `useAppsConfig` does NOT yet compare configs before calling `setConfig`.

**How to avoid:** Existing Phase 2 plan already specifies the fix: compare JSON in the watcher callback before setting state. This MUST be implemented before Phase 3 mutations are added.

```typescript
// In useAppsConfig watcher callback:
const updated = await invoke<NexusConfig>("reload_config");
setConfig(prev => {
  if (JSON.stringify(prev) === JSON.stringify(updated)) return prev; // no-op
  return updated;
});
```

**Warning signs:** After adding an app, it appears twice in the sidebar briefly.

### Pitfall 2: DnD Context Wrapping the Wrong Level

**What goes wrong:** `DndContext` is placed inside `Sidebar.tsx` but the list re-renders don't propagate up to `App.tsx` and config doesn't update.

**Why it happens:** `reorderApps` needs to call `invoke('save_config')`, which requires access to `config` from the hook — but `Sidebar.tsx` only receives `config` as a prop.

**How to avoid:** Pass `reorderApps` and `reorderGroups` as props to `Sidebar` from `App.tsx`. Alternatively, put `DndContext` in `App.tsx` itself (above `Sidebar`), pass drag event handlers down. The simpler option is to hoist the `DndContext` to `App.tsx`.

**Warning signs:** Drag ends without reordering; no `save_config` call fires.

### Pitfall 3: Context Menu Action Closures Capturing Stale App Data

**What goes wrong:** The `onContextMenu` handler creates the menu with `action` callbacks. If `config` changes between when the menu is created and when the user clicks "Remove", the callback may reference a stale app object.

**Why it happens:** React closures in event handlers capture the state at the time of the event creation, not at click time.

**How to avoid:** Pass the `app.id` string into the action, not the whole `app` object. The mutation functions (`removeApp`, `reorderApps`) look up the current config from the hook at invocation time.

```typescript
onContextMenu={async (e) => {
  e.preventDefault();
  const appId = app.id; // capture only the stable ID
  const menu = await Menu.new({
    items: [
      await MenuItem.new({ text: 'Remove', action: () => removeApp(appId) }),
    ],
  });
  await menu.popup();
}}
```

### Pitfall 4: Palette Closing on Input Click

**What goes wrong:** Clicking inside the palette input triggers the backdrop `onClick` handler and closes the palette.

**Why it happens:** Event bubbling — `click` on input bubbles up to the backdrop div.

**How to avoid:** Add `onClick={e => e.stopPropagation()}` on the palette container div (already shown in Pattern 1 code above).

**Warning signs:** Palette closes immediately when clicked anywhere inside it.

### Pitfall 5: Remove Active App — Webview Not Destroyed

**What goes wrong:** App is removed from `config.apps` and `save_config` is called, but the child webview (`app-{id}`) continues to live as a native window behind the main window.

**Why it happens:** `save_config` only writes the file and updates `AppState.config`. It does not destroy existing webviews.

**How to avoid:** After removing from config, call `invoke('destroy_webview', { appId })` explicitly. The `destroy_webview` command calls `WebviewWindow.close()` and removes the ID from `AppState.webviews_created`.

**Warning signs:** After removing and re-adding the same app, a new webview is created but the old one is still running (two sessions).

### Pitfall 6: DnD in Tauri — Mouse Events on Child Webviews

**What goes wrong:** The child app webviews (native OS windows) are layered above the sidebar React UI. If a drag gesture leaves the sidebar area and enters the webview area, the webview captures mouse events and the drag "sticks" or terminates unexpectedly.

**Why it happens:** The webview is a native OS window, not a DOM element. It captures all pointer events in its bounds.

**How to avoid:** This is only an issue if the user drags an item out of the sidebar into the main content area. Since drag-and-drop reordering happens within the sidebar (narrow 220px column), this is unlikely in practice. If needed: during drag start, call `invoke('hide_active_webview')` to temporarily remove the webview from the window hierarchy, then restore on drag end. For Phase 3, accept the limitation and document it.

**Warning signs:** Drag releases mid-air when cursor crosses the sidebar/webview boundary.

### Pitfall 7: Menu Bar Accelerator Display vs. Actual Shortcut

**What goes wrong:** Accelerator displayed in the menu bar (`Cmd+N`) does not actually trigger — only the `on_menu_event` handler fires when clicking the menu item, not on keypress.

**Why it happens:** macOS menu bar accelerators are cosmetic in Tauri unless the menu item is actually triggered by the shortcut system. The global shortcut plugin handles actual key events.

**How to avoid:** Register Cmd+N as a real global shortcut in `lib.rs` (same pattern as Cmd+K). The menu bar entry just shows the shortcut as documentation. Both paths (menu click and keypress) dispatch the same action.

---

## Code Examples

Verified patterns from official sources and codebase inspection.

### Full CommandPalette component structure

```tsx
// src/components/CommandPalette.tsx
import { useEffect, useRef, useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { AppConfig, NexusConfig } from '../types';

type PaletteMode = 'search' | 'action' | 'add-form';

interface AddFormState { url: string; name: string; step: 'url' | 'name'; }

interface CommandPaletteProps {
  isOpen: boolean;
  config: NexusConfig;
  activeAppId: string | null;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onAdd: (name: string, url: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReload: () => void;
  onToggleSidebar: () => void;
}

export function CommandPalette({
  isOpen, config, activeAppId, onClose, onSwitch, onAdd, onRemove, onReload, onToggleSidebar
}: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>('search');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addForm, setAddForm] = useState<AddFormState>({ url: '', name: '', step: 'url' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode('search');
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return config.apps;
    const fuse = new Fuse(config.apps, { keys: ['name'], threshold: 0.4 });
    return fuse.search(query).map(r => r.item);
  }, [config.apps, query]);

  const actions = [
    { id: 'add-app', label: 'Add new app' },
    { id: 'remove-app', label: `Remove ${activeAppId ? config.apps.find(a => a.id === activeAppId)?.name ?? '' : ''}` },
    { id: 'reload', label: 'Reload page' },
    { id: 'toggle-sidebar', label: 'Toggle sidebar' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={onClose}>
      <div className="w-[560px] rounded-xl bg-[#1c1c21] shadow-2xl ring-1 ring-white/10"
           onClick={e => e.stopPropagation()}>
        {mode !== 'add-form' && (
          <input
            ref={inputRef}
            className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
            placeholder={mode === 'action' ? 'Type an action...' : 'Search apps...'}
            value={query}
            onChange={e => {
              const v = e.target.value;
              setQuery(v.startsWith('>') ? v : v);
              setMode(v.startsWith('>') ? 'action' : 'search');
              setSelectedIndex(0);
            }}
            onKeyDown={/* arrow nav, Enter, Escape */() => {}}
          />
        )}
        {/* Results list or Add form */}
      </div>
    </div>
  );
}
```

### dnd-kit sortable sidebar (minimal)

```tsx
// Source: https://docs.dndkit.com/presets/sortable
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableApp({ app, isActive, onClick, onContextMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: app.id });

  return (
    <li ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}>
      <button
        style={{ opacity: isDragging ? 0.5 : 1 }}
        {...listeners}        // drag handle = whole button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-sm ${
          isActive ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-gray-800'
        }`}
      >
        {/* favicon + name */}
      </button>
    </li>
  );
}

// In Sidebar.tsx wrapping group apps:
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={config.apps.map(a => a.id)} strategy={verticalListSortingStrategy}>
    {groupApps.map(app => <SortableApp key={app.id} app={app} ... />)}
  </SortableContext>
</DndContext>
```

### destroy_webview Rust command

```rust
// In src-tauri/src/commands/webview.rs:
#[tauri::command]
pub fn destroy_webview(
    app_id: String,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let label = format!("app-{}", app_id);
    if let Some(wv) = app_handle.get_webview(&label) {
        wv.close().map_err(|e| e.to_string())?;
    }
    let mut st = state.lock().map_err(|e| e.to_string())?;
    st.webviews_created.remove(&app_id);
    if st.active_app_id.as_deref() == Some(app_id.as_str()) {
        st.active_app_id = None;
    }
    Ok(())
}
```

### Menu capabilities addition

```json
// src-tauri/capabilities/default.json — add to "permissions":
"menu:allow-new",
"menu:allow-append",
"menu:allow-popup"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-beautiful-dnd` | `@dnd-kit/sortable` | 2023 (rbd deprecated) | Must use dnd-kit; rbd has no Tauri 2 compatibility updates |
| Custom fuzzy search | `fuse.js` (standard) | Stable since 2016, v7 in 2023 | No reason to hand-roll; fuse.js API stable |
| Tauri v1 window menu | `MenuBuilder` + `SubmenuBuilder` in Tauri 2 | Oct 2024 (Tauri 2.0) | API completely different from v1; old tutorials don't apply |
| Third-party context menu plugins | `@tauri-apps/api/menu` `Menu.popup()` | Tauri 2.0 (built-in) | No plugin needed; use official JS API |

**Deprecated/outdated:**
- `tauri-plugin-context-menu` (v1 plugin): Do NOT use; superseded by built-in Tauri 2 Menu API.
- `react-beautiful-dnd`: Deprecated 2023. Do NOT use.
- `tauri::api::menu` (Tauri v1): Does not exist in Tauri 2.

---

## Open Questions

1. **Cross-group drag: visual line indicator**
   - What we know: `@dnd-kit/core` provides `over` state during drag for collision detection.
   - What's unclear: The exact approach for rendering a horizontal insertion line between items across group boundaries (requires knowing not just `over.id` but position within the group).
   - Recommendation: Use dnd-kit's `DragOverlay` for the "ghost" item at 50% opacity. For the insertion line, track `over.id` and render a `<div className="h-px bg-white/30 mx-2" />` above/below the hovered item. Accept slight visual imperfection for Phase 3; refine in polish pass.

2. **Cmd+N as global shortcut vs. menu bar only**
   - What we know: The menu bar entry for "Add App Cmd+N" is documented. Whether Cmd+N should work as a real global shortcut (opening palette in add-form mode) is not explicitly decided.
   - What's unclear: User decision says menu bar is "just for shortcuts to appear documented." Does that mean Cmd+N fires the action or just documents it?
   - Recommendation: Register Cmd+N as a real global shortcut (same pattern as Cmd+K) that opens the command palette in add-form mode. This is consistent with the Spotlight-style keyboard-first UX and the menu bar entry behavior users expect on macOS.

3. **Edit... form: inline palette vs. separate component**
   - What we know: Decision says "inline in palette or mini dialog" — with "Edit..." going "inline in palette" as the plan.
   - What's unclear: Whether the "Edit..." form reuses the same `add-form` state machine with pre-filled fields (URL + name) and calls `editApp(id, name, url)` instead of `addApp`.
   - Recommendation: Reuse the add-form state in the palette: a new `PaletteMode = 'edit-form'` that pre-fills URL and name from the selected app. On submit, call a new `editApp(id, name, url)` mutation that patches the existing app entry in config.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + Rust `#[cfg(test)]` (backend) |
| Config file | `vite.config.ts` — no `test:{}` block yet (Wave 0 gap) |
| Quick run command | `cargo test -p nexus && pnpm vitest run --reporter=dot` |
| Full suite command | `cargo test -p nexus && pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | Cmd+K emits `open-palette` CustomEvent | manual-only | — | N/A (requires runtime) |
| CMD-02 | `fuzzySearchApps()` returns matching apps by name | unit (TS) | `pnpm vitest run src/__tests__/fuzzySearch.test.ts` | ❌ Wave 0 |
| CMD-02 | Empty query returns all apps | unit (TS) | same file | ❌ Wave 0 |
| CMD-03 | `addApp()` generates correct id from name | unit (TS) | `pnpm vitest run src/__tests__/useAppsConfig.test.ts` | ❌ Wave 0 |
| CMD-03 | `addApp()` assigns empty group for "Other" bucket | unit (TS) | same file | ❌ Wave 0 |
| CMD-04 | `removeApp()` removes app from config.apps | unit (TS) | same file | ❌ Wave 0 |
| CMD-04 | `removeApp()` clears `lastActiveAppId` when active app removed | unit (TS) | same file | ❌ Wave 0 |
| CONF-05 | `reorderApps()` produces correct order after arrayMove | unit (TS) | same file | ❌ Wave 0 |
| NAV-06 | Drag end updates apps array order | unit (TS) | same file | ❌ Wave 0 |
| destroy_webview | Removes app_id from `webviews_created` in AppState | unit (Rust) | `cargo test -p nexus -- destroy_webview` | ❌ Wave 0 |
| Context menu | Right-click shows native menu (Open/Reload/Edit/Remove) | manual-only | — | N/A (requires runtime) |
| Drag visual | 50% opacity ghost + insertion line visible during drag | manual-only | — | N/A (requires visual inspection) |

### Sampling Rate

- **Per task commit:** `cargo test -p nexus && pnpm vitest run --reporter=dot`
- **Per wave merge:** `cargo test -p nexus && pnpm vitest run`
- **Phase gate:** Full suite green + manual smoke test of all 4 success criteria before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/fuzzySearch.test.ts` — covers CMD-02 search behavior
- [ ] `src/__tests__/useAppsConfig.test.ts` — covers CMD-03, CMD-04, CONF-05, NAV-06 mutations
- [ ] `vite.config.ts` `test: {}` block — Vitest runner setup (not present yet)
- [ ] Rust: `#[cfg(test)]` block in `commands/webview.rs` for `destroy_webview` AppState mutation

---

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Menu JS API Reference](https://v2.tauri.app/reference/javascript/api/namespacemenu/) — `Menu.new()`, `MenuItem.new()`, `popup()`, permissions
- [Tauri v2 Window Menu Guide](https://v2.tauri.app/learn/window-menu/) — `MenuBuilder`, `SubmenuBuilder`, `on_menu_event`, Rust examples
- [dnd-kit Sortable docs](https://docs.dndkit.com/presets/sortable) — `useSortable`, `SortableContext`, `arrayMove`, `DragOverlay` — verified complete example
- [tauri-app-menu-example (React)](https://github.com/crutchcorn/tauri-app-menu-example) — JS Menu API with React, permissions list
- [fuse.js official site](https://www.fusejs.io/) — `Fuse` constructor, `keys`, `threshold`, search API
- Codebase inspection (2026-03-19) — `lib.rs`, `commands/webview.rs`, `commands/config.rs`, `config.rs`, `state.rs`, `useAppsConfig.ts`, `Sidebar.tsx`, `App.tsx`, `types.ts`, `Cargo.toml`, `capabilities/default.json`

### Secondary (MEDIUM confidence)
- [dnd-kit GitHub (clauderic)](https://github.com/clauderic/dnd-kit) — bundle size (10 kB gzipped core), maintenance status
- [fuse.js npm page](https://www.npmjs.com/package/fuse.js) — v7.1.0 confirmed current version, zero dependencies
- WebSearch cross-reference: `react-beautiful-dnd` deprecated 2023 — multiple sources confirm

### Tertiary (LOW confidence)
- WebSearch for Tauri 2 context menu Rust-side examples — limited concrete code; JS-side approach confirmed as simpler and officially supported

---

## Metadata

**Confidence breakdown:**
- Command palette React pattern: HIGH — standard Spotlight-clone pattern, no Tauri-specific unknowns
- fuse.js API: HIGH — stable API since v6, verified on official site
- dnd-kit sortable API: HIGH — verified complete code example from official docs
- Tauri JS context menu (`Menu.popup()`): HIGH — verified from official API reference + React example
- Tauri Rust menu bar (`MenuBuilder`): HIGH — verified from official guide
- `destroy_webview` via `WebviewWindow.close()`: MEDIUM — API confirmed in Tauri docs; behavior of `webviews_created.remove()` is logical but untested
- Cross-group drag line indicator: LOW — no direct documentation; approach is reasoned from dnd-kit primitives

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (Tauri 2 APIs and dnd-kit move fast; verify versions before executing)

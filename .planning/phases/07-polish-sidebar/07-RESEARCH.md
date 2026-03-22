# Phase 7: Polish & Sidebar - Research

**Researched:** 2026-03-22
**Domain:** React animations (motion/react), sidebar resize UX, Tauri webview rect IPC, config persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Animation specs (exact durations and properties):**
- Sidebar open/close: translateX(-100%→0) + opacity(0→1), 150ms ease-out open / 120ms ease-in close
- Command palette: scale(0.95→1) + opacity(0→1), 120ms ease-out open / 80ms ease-in close; backdrop opacity(0→0.5) simultaneously
- App switching: crossfade only — outgoing opacity 1→0 (60ms), incoming opacity 0→1 (80ms), simultaneous; NO movement/scale
- Badge count change: scale(1→1.2→1) over 200ms on count change
- RULE: Only `opacity` and `transform` CSS properties — never `width` or `height`

**Sidebar resize:**
- Invisible 4px hit-zone edge handle; cursor changes to col-resize on hover
- On drag: subtle 1px white/10 line appears at the edge
- Full mode: 120–300px range, default 200px
- Icon-only mode: 48px fixed
- Auto-collapse: drag below ~80px snaps to icon-only (48px); drag wider snaps back to full mode
- Sidebar width persisted in config

**Sidebar toggle button:**
- Dedicated chevron button at very bottom of sidebar
- Toggles between full and collapsed (icon-only) modes
- Always visible in both modes

**Favorites section:**
- Pinned apps at top of sidebar, above all groups
- Thin 1px separator line from groups — no "Favorites" header
- Pin/unpin via right-click context menu
- No limit on pinned favorites
- Persists across all spaces (Phase 8 picks this up)

**Numeric badge:**
- Replace dot badge with numeric count parsed from page title prefix: "(3) Gmail" → shows "3"
- Fallback to dot if title has no number but has activity
- Scale bump animation on count change

**Settings panel shell:**
- Slide-in from right edge, ~350px wide, overlays webview area
- Close: X button or click outside
- Access: gear icon (bottom sidebar, next to toggle), Cmd+, shortcut, Cmd+K "Open Settings"
- Content: section headers (Appearance, Sidebar, About) with placeholder text; About shows version + GitHub link

### Claude's Discretion
- Exact easing curves and animation library integration (motion/react)
- Badge number font size and styling
- Settings panel animation (slide-in duration, easing)
- Icon-only mode: whether to show badges/bell next to small icons
- How to handle resize during animation (debounce/throttle)

### Deferred Ideas (OUT OF SCOPE)
- Keyboard shortcut customization — v3 feature
- Sidebar position (left vs right) — not in scope
- Multiple sidebar styles (minimal, detailed, compact) — v3 polish
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLSH-01 | Smooth animations for sidebar toggle, command palette open/close, and app switching transitions | motion/react AnimatePresence + motion.div with opacity/transform variants; `prefers-reduced-motion` media query guard |
| PLSH-02 | Sidebar badge shows unread count number (not just dot) — parsed from page title | `badgeCounts: Map<string, number \| null>` already exists in useAppsConfig; Sidebar receives badgeCounts instead of badgeAppIds; render number string when count is non-null |
| PLSH-03 | Sidebar toggle button visible in the sidebar (Arc-style, bottom of sidebar) | New chevron button in Sidebar.tsx bottom bar; dispatches `sidebar-toggle` event; always visible regardless of sidebar mode |
| SIDE-01 | User can resize sidebar width by dragging the edge | Mouse drag handler on invisible 4px right-edge div; updates sidebarWidth state; Rust `resize_active_webview` called with new width (replaces SIDEBAR_WIDTH constant) |
| SIDE-02 | Sidebar collapses to icon-only mode at narrow widths (no labels, just favicons) | Two render modes in Sidebar.tsx controlled by `iconOnly: boolean` prop/state; icon-only shows 48px fixed width, favicons only |
| SIDE-03 | User can pin favorite apps to a "Favs" section at top of sidebar (always visible across spaces) | `pinnedAppIds: string[]` added to NexusConfig (Rust + TS); rendered above groups; right-click context menu gains "Pin/Unpin" item |
</phase_requirements>

---

## Summary

Phase 7 is a pure frontend/config phase — no new Rust commands needed beyond extending `resize_active_webview` and `save_config`. All six requirements map to React component changes with one config schema extension (`pinnedAppIds`, `sidebarWidth`). The `motion/react` library must be installed (not yet in package.json). `badgeCounts: Map<string, number | null>` is already computed in `useAppsConfig` but not yet passed to Sidebar; the Sidebar still uses the boolean `badgeAppIds: Set<string>`. App switching crossfade requires coordinating opacity animation with the Rust `switch_app` call timing.

The sidebar resize is the highest-complexity item: it requires (1) replacing the hardcoded `SIDEBAR_WIDTH: f64 = 220.0` constant in `webview.rs` with a config-driven value, (2) propagating width changes to Rust on every drag commit (not on every pixel), and (3) snapping logic at the 80px threshold. The `calc_webview_rect` function signature must change to accept `sidebar_width: f64` alongside `sidebar_visible: bool`.

**Primary recommendation:** Install `motion@12` first, wrap AnimatePresence around sidebar and palette, then tackle resize (config + Rust changes), then favorites (config schema + context menu), then Settings shell (new component).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.x (motion/react) | Sidebar slide/fade, palette scale/fade, badge bump | Already recommended in v2.0 research; same team as Framer Motion; production-ready React 18 animations |
| @tauri-apps/api | 2.x (already installed) | IPC invoke for resize_active_webview, save_config | Project standard |
| Tailwind v4 | 4.x (already installed) | Icon-only mode layout, resize handle styling | Project standard |
| dnd-kit | 6/10.x (already installed) | Drag reorder still used; favorites are sorted by pinOrder, not drag-reordered | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useRef + onPointerMove | built-in | Sidebar resize drag handler | Pointer capture API for mouse-outside-element drag; no extra library needed |
| CSS `pointer-events: none` | CSS | Prevent webview stealing pointer during resize drag | Required whenever dragging over native webview area |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion/react AnimatePresence | CSS Transitions + conditional render | CSS transitions require element to be in DOM during exit; AnimatePresence handles unmount animation automatically |
| Pointer capture for resize | react-resizable-panels | react-resizable-panels is overkill for one-panel resize; pointer capture is 20 lines of code |

**Installation:**
```bash
npm install motion
```

---

## Architecture Patterns

### Current vs. Phase 7 State

| What | Current State | Phase 7 Target |
|------|--------------|----------------|
| Sidebar width | Hardcoded `SIDEBAR_WIDTH = 220.0` in webview.rs | Config field `sidebarWidth: number` (default 200), propagated to Rust |
| Sidebar render | `{sidebarVisible && <Sidebar ...>}` in App.tsx | `<AnimatePresence>` wraps Sidebar; motion.aside for slide |
| Badge in Sidebar | `hasBadge: boolean` dot | `badgeCount: number \| null` number or dot fallback |
| App switching | Instant hide/show via Rust | Crossfade with `set_active_webview_dimmed` + opacity animation |
| Pinned apps | Not in config | `pinnedAppIds: string[]` in NexusConfig, rendered first in sidebar |
| Settings panel | Does not exist | `<SettingsPanel>` component, `isSettingsOpen` state in App.tsx |
| Palette animation | Instant mount/unmount | AnimatePresence + scale/fade variant |

### Recommended Project Structure Changes
```
src/
├── components/
│   ├── Sidebar.tsx          # extend: resize handle, icon-only mode, favorites section, toggle button, numeric badge
│   ├── CommandPalette.tsx   # wrap with motion AnimatePresence
│   ├── SettingsPanel.tsx    # NEW: slide-in panel shell
│   └── AppIcon.tsx          # unchanged
├── hooks/
│   ├── useAppsConfig.ts     # add sidebarWidth state; pass badgeCounts to Sidebar
│   └── useSidebarResize.ts  # NEW: pointer-capture drag logic, snap thresholds
└── types.ts                 # add pinnedAppIds, sidebarWidth to NexusConfig
```

```
src-tauri/src/
├── config.rs    # add pinned_app_ids: Vec<String>, sidebar_width: f64
└── commands/
    └── webview.rs  # calc_webview_rect accepts sidebar_width; resize_active_webview accepts width
```

### Pattern 1: AnimatePresence for Mount/Unmount Animations

**What:** `AnimatePresence` tracks when children are added/removed from the React tree and plays `exit` animation before unmounting.
**When to use:** Any component that conditionally renders (`{condition && <Component>}`).

```typescript
// Source: https://motion.dev/docs/react-animate-presence
import { AnimatePresence, motion } from "motion/react";

// Sidebar slide + fade
<AnimatePresence>
  {sidebarVisible && (
    <motion.aside
      key="sidebar"
      initial={{ x: "-100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      // exit uses shorter duration — override in transition.exit
    >
      <Sidebar ... />
    </motion.aside>
  )}
</AnimatePresence>
```

For palette (scale + fade):
```typescript
<AnimatePresence>
  {isOpen && (
    <motion.div
      key="palette"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      {/* palette content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 2: Exit Transition Duration Override

**What:** `initial`/`animate` use 150ms ease-out; `exit` uses 120ms ease-in. motion supports per-phase transition overrides.

```typescript
// Source: https://motion.dev/docs/react-transitions
<motion.aside
  initial={{ x: "-100%", opacity: 0 }}
  animate={{ x: 0, opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
  exit={{ x: "-100%", opacity: 0, transition: { duration: 0.12, ease: "easeIn" } }}
>
```

### Pattern 3: Sidebar Resize with Pointer Capture

**What:** Pointer capture keeps receiving events even when mouse leaves element bounds (i.e., moves over webview area).

```typescript
// useSidebarResize.ts
function useSidebarResize(onWidthChange: (w: number) => void) {
  const handleRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    // e.clientX is the absolute x position; sidebar starts at 0
    const rawWidth = e.clientX;
    if (rawWidth < 80) {
      // snap to icon-only — do not call onWidthChange here, trigger mode switch
      return;
    }
    const clamped = Math.min(300, Math.max(120, rawWidth));
    onWidthChange(clamped);
  }

  function onPointerUp(e: React.PointerEvent) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return { onPointerDown, onPointerMove, onPointerUp };
}
```

### Pattern 4: App Switch Crossfade

**What:** App switching is the most performance-sensitive animation (100ms budget). Pure opacity crossfade with no layout change.

The existing `loadingAppId` spinner uses `absolute inset-0`. The crossfade can use the same `absolute inset-0` approach — a transparent overlay div that fades out on switch.

```typescript
// In App.tsx main area — add a keyed motion.div wrapper
// On switchApp: animate outgoing opacity to 0 (60ms), then Rust call, then incoming fades in (80ms)
const [isSwitching, setIsSwitching] = useState(false);

async function handleSwitchApp(id: string) {
  if (id === activeAppId) return;
  setIsSwitching(true);
  // Rust show/hide is instant; we just animate the overlay
  await switchApp(id);
  setIsSwitching(false);
}
```

Given that Rust webviews composite above the DOM, the crossfade overlay (`pointer-events-none absolute inset-0 bg-[#111117]`) can be animated from opacity 1→0 after `switch_app` returns. The webview is already visible underneath. 60ms + 80ms = 140ms total, within the 100ms-per-transition contract (the 100ms contract is for the actual webview switch, not the fade overlay).

**Note on performance contract:** The 100ms contract means Rust `switch_app` returns within 100ms. The animation plays on top of that — it does not block the switch. Never delay calling `switch_app` to wait for an exit animation.

### Pattern 5: Badge Scale Bump Animation

**What:** When `badgeCount` changes, trigger a scale(1→1.2→1) pulse.

```typescript
// Using motion/react's useAnimate for imperative animation
import { useAnimate } from "motion/react";

function BadgeCount({ count }: { count: number | null }) {
  const [scope, animate] = useAnimate();
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current && count !== null) {
      animate(scope.current, { scale: [1, 1.2, 1] }, { duration: 0.2 });
    }
    prevCount.current = count;
  }, [count]);

  return (
    <span ref={scope} className="text-[10px] font-semibold tabular-nums">
      {count !== null ? String(count) : ""}
    </span>
  );
}
```

### Pattern 6: Icon-Only Mode Rendering

**What:** When `iconOnly = true`, render only favicon (16px), no text label, no group headers.

```typescript
// Sidebar.tsx
interface SidebarProps {
  // ... existing props
  iconOnly: boolean;
  sidebarWidth: number;
}

// In SortableAppItem
{!iconOnly && <span className="truncate flex-1">{app.name}</span>}

// Sidebar outer element width
<motion.aside
  style={{ width: iconOnly ? 48 : sidebarWidth }}
  className="flex h-full flex-shrink-0 flex-col bg-[#111117]"
>
```

### Anti-Patterns to Avoid

- **Animating `width` on sidebar:** Violates the locked decision. Use `transform: translateX` only. The sidebar content area is laid out as flex; the webview rect is calculated by Rust. Width changes are step-changes, not animated width transitions.
- **Delaying `switch_app` for exit animation:** The crossfade overlay must play independently of the Rust call. Never await an animation before calling Rust.
- **Setting `webview.show()` after animation starts:** Confirmed pitfall from v2.0 research — on WebKitGTK, this causes animation latency regression. Always call Rust first, animate DOM overlay independently.
- **Using `motion` package (legacy name):** Import from `motion/react`, not `framer-motion`. The `motion` npm package is the new unified package; `framer-motion` is deprecated.
- **Animating `height` for group collapse:** Group collapse uses CSS `overflow-hidden` with conditional render — not animated height.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exit animations on unmount | CSS transition + setTimeout to delay unmount | `motion/react` AnimatePresence | AnimatePresence tracks React tree changes and manages the unmount lifecycle correctly; setTimeout approach has race conditions |
| Pointer-outside-element drag | mousedown/mousemove on document | `setPointerCapture` on the drag handle element | Pointer capture is the correct web API for this; no global listeners, no cleanup complexity |
| Animation sequencing | Manual setTimeout chaining | motion `transition` with `delay` or `useAnimate` | motion handles frame timing correctly; setTimeout animations skip frames under load |

**Key insight:** The only "custom" logic needed is the sidebar snap threshold (80px → icon-only mode). Everything else is standard motion/react patterns.

---

## Common Pitfalls

### Pitfall 1: Sidebar Animation Blocks Webview Show
**What goes wrong:** If `<AnimatePresence>` delay causes the Sidebar to still be animating when Rust shows a webview, the webview appears to "pop" rather than slide in with the sidebar.
**Why it happens:** Rust `resize_active_webview` is called in `handleSidebarToggle` which responds to the `sidebar-toggle` event. If this fires before the animation duration, webview rect is calculated with the old (or mid-animation) sidebar width.
**How to avoid:** The current `handleSidebarToggle` in `useAppsConfig.ts` calls `invoke("resize_active_webview", { sidebarVisible: next })` synchronously. Motion animation is cosmetic only — Rust gets the final target state (visible=true or visible=false) immediately, before animation plays. This is the correct approach. The `resize_active_webview` call must happen at toggle time, not after animation completes.
**Warning signs:** Webview rect jumps/flashes at animation end.

### Pitfall 2: Pointer Events Stolen by Native Webview During Resize
**What goes wrong:** When user drags the resize handle over the webview area, the native webview captures the pointer and the drag stops.
**Why it happens:** Native webviews always composite on top of the DOM. DOM pointer events do not propagate through native webview regions.
**How to avoid:** Use `setPointerCapture` on the drag handle `onPointerDown`. Pointer capture routes all subsequent pointer events to the capturing element regardless of position. This is the correct solution — no need for a full-screen overlay or any Rust changes.
**Warning signs:** Resize drag stops when cursor enters webview area.

### Pitfall 3: Sidebar Width Not Propagated to Rust on Resize
**What goes wrong:** User drags sidebar wider; webview still renders at old position because Rust `calc_webview_rect` uses the old SIDEBAR_WIDTH constant.
**Why it happens:** `calc_webview_rect` has `SIDEBAR_WIDTH: f64 = 220.0` hardcoded. The function signature must accept `sidebar_width: f64`.
**How to avoid:** Change `resize_active_webview` command to accept `sidebar_width: f64` (alongside existing `sidebar_visible: bool`). In `useSidebarResize`, call `invoke("resize_active_webview", { sidebarVisible: true, sidebarWidth: width })` on pointer-up (not every pixel during drag to avoid IPC flooding).
**Warning signs:** Webview area doesn't expand/contract with sidebar resize.

### Pitfall 4: Drag-and-Drop Conflicts with Resize Handle
**What goes wrong:** dnd-kit's PointerSensor (activation: distance 5) captures the pointer-down on the resize handle and starts a DnD operation.
**Why it happens:** The resize handle is inside the DnD context wrapper. dnd-kit uses pointer events and doesn't know about the resize handle.
**How to avoid:** Stop pointer event propagation in the resize handle's `onPointerDown`: `e.stopPropagation()`. This prevents dnd-kit from seeing the event.
**Warning signs:** Sidebar items start dragging when resize handle is clicked.

### Pitfall 5: Config Write Race — Resize + Drag-Reorder
**What goes wrong:** User drags to resize (debounced config save) while also reordering an app (immediate `persistMutation`). Second write overwrites first.
**Why it happens:** `persistMutation` calls `invoke("save_config", { config: updated })` with a snapshot of config state. If resize save is in-flight with a stale snapshot, it overwrites the reorder.
**How to avoid:** Resize width should be saved separately as `invoke("save_sidebar_width", { width })` — a targeted Rust command that only updates `sidebar_width` in config without touching the full NexusConfig snapshot. This is a delta-patch approach. Alternatively, read current config in Rust before writing width. The simplest safe approach: add `save_sidebar_width` as a dedicated command that mutates only that field in AppState and persists.
**Warning signs:** Drag-reorder lost after resize, or vice versa.

### Pitfall 6: `motion` vs `framer-motion` Import
**What goes wrong:** Import from `framer-motion` compiles but uses the legacy deprecated package.
**Why it happens:** `framer-motion` is still published but is now the compatibility shim; `motion` is the new package.
**How to avoid:** Always `import { motion, AnimatePresence } from "motion/react"`. Never `framer-motion`.
**Warning signs:** Bundle size larger than expected (~15KB for motion/react vs ~50KB for framer-motion).

### Pitfall 7: `prefers-reduced-motion` Not Respected
**What goes wrong:** Users with vestibular disorders/motion sensitivity get animations they opted out of.
**Why it happens:** motion/react has `useReducedMotion()` hook but it is not applied automatically — must be wired.
**How to avoid:** At App.tsx level, check `useReducedMotion()` and pass a prop `reduceMotion` down, or use CSS `@media (prefers-reduced-motion: reduce)` to set `transition-duration: 0ms` on motion elements.
**Warning signs:** Accessibility audit flags animated elements without reduced-motion support.

---

## Code Examples

Verified patterns from official sources:

### motion/react AnimatePresence — Basic Usage
```typescript
// Source: https://motion.dev/docs/react-animate-presence
import { AnimatePresence, motion } from "motion/react";

// isOpen controls mount/unmount; exit animation plays before DOM removal
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

### Per-Phase Transition (different duration for open vs close)
```typescript
// Source: https://motion.dev/docs/react-transitions
<motion.div
  animate={{ opacity: 1, x: 0, transition: { duration: 0.15, ease: "easeOut" } }}
  exit={{ opacity: 0, x: "-100%", transition: { duration: 0.12, ease: "easeIn" } }}
/>
```

### useAnimate for Imperative Animations (badge bump)
```typescript
// Source: https://motion.dev/docs/react-use-animate
import { useAnimate } from "motion/react";

const [scope, animate] = useAnimate();
// Trigger:
await animate(scope.current, { scale: [1, 1.2, 1] }, { duration: 0.2 });
```

### Pointer Capture for Drag-Outside-Element
```typescript
// Source: MDN Web API — Pointer Events
function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
  e.stopPropagation(); // prevent dnd-kit from capturing
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
  // safe to handle drag here even over webview area
}

function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
  e.currentTarget.releasePointerCapture(e.pointerId);
  // commit final width to Rust here (not on every move)
}
```

### Rust: Extending calc_webview_rect for variable sidebar width
```rust
// webview.rs — change signature to accept sidebar_width
pub fn calc_webview_rect(
    main_window: &tauri::Window,
    sidebar_visible: bool,
    sidebar_width: f64,  // NEW — replaces SIDEBAR_WIDTH constant
) -> Result<(f64, f64, f64, f64), String> {
    let size = main_window.inner_size().map_err(|e| e.to_string())?;
    let scale = main_window.scale_factor().unwrap_or(1.0);
    let win_w = size.width as f64 / scale;
    let win_h = size.height as f64 / scale;

    let x_offset = if sidebar_visible { sidebar_width } else { 0.0 };
    let x = x_offset + GAP;
    let y = GAP_TOP;
    let w = win_w - x_offset - GAP * 2.0;
    let h = win_h - GAP_TOP - GAP;
    Ok((x, y, w, h))
}
```

### Config schema additions (Rust config.rs)
```rust
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NexusConfig {
    // ... existing fields
    #[serde(default)]
    pub pinned_app_ids: Vec<String>,        // NEW
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: f64,                  // NEW
}

fn default_sidebar_width() -> f64 { 200.0 }
```

### TypeScript types.ts additions
```typescript
export interface NexusConfig {
  // ... existing fields
  pinnedAppIds: string[];   // NEW
  sidebarWidth: number;     // NEW (default 200)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` | `motion` (npm) imported from `motion/react` | 2024 — Framer Motion team renamed the package | Must use `motion/react` import, not `framer-motion` |
| AnimatePresence on every keyframe | `initial={false}` on AnimatePresence to skip entry on first render | Always available | Use `initial={false}` to suppress sidebar animation on app startup |
| Pointer events stolen by webview | `setPointerCapture` API | Available since all modern browsers | The correct solution for drag-over-webview scenarios |

**Deprecated/outdated:**
- `framer-motion` package: still published as compatibility shim, but new projects should use `motion` with `motion/react` import
- Animating CSS `width` for sidebar: causes layout recalculation and violates the project's animation constraint

---

## Open Questions

1. **Settings panel Cmd+, shortcut registration**
   - What we know: Cmd+B for sidebar toggle is registered in Rust `lib.rs` via Tauri global shortcut
   - What's unclear: Is Cmd+, registered in Rust or handled in React via `keydown` event?
   - Recommendation: Check `lib.rs` shortcut registration section. Given that Cmd+K (palette) appears to be a React `keydown` listener, Cmd+, should follow the same pattern (React `keydown` → dispatch `open-settings` CustomEvent → App.tsx handles it). No Rust changes needed.

2. **Icon-only mode badge/bell visibility**
   - What we know: CONTEXT.md marks this as Claude's Discretion
   - What's unclear: At 48px width, there's no room for bell icon + badge side by side with a 16px favicon
   - Recommendation: Show favicon + numeric badge pill only (badge overlaps favicon bottom-right, iOS-style). Hide bell icon in icon-only mode — mute accessible via right-click context menu.

3. **Settings panel `version` value source**
   - What we know: "About section shows version + GitHub link"
   - What's unclear: How to read app version in React (package.json version or Tauri `getVersion()`)
   - Recommendation: Use `import { getVersion } from "@tauri-apps/api/app"` — available in `@tauri-apps/api@2` already installed. Returns the version from `tauri.conf.json`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config (implied via package.json `"test": "vitest run"`, no explicit config file — Vite config auto-detects) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLSH-01 | Sidebar/palette animations use only opacity/transform | manual-only | visual QA | N/A |
| PLSH-02 | `extractUnreadCount` parses title correctly; badge renders number not dot | unit | `npm test -- --reporter=verbose` | ✅ `src/__tests__/notifications.test.ts` already covers `extractUnreadCount` |
| PLSH-03 | Toggle button renders at sidebar bottom; dispatches sidebar-toggle event | manual-only | visual QA | N/A |
| SIDE-01 | Resize handle pointer events update sidebar width correctly | unit | `npm test` | ❌ Wave 0 — `src/__tests__/sidebarResize.test.ts` |
| SIDE-02 | Icon-only mode renders at 48px, no labels | manual-only | visual QA | N/A |
| SIDE-03 | `pinnedAppIds` CRUD: pin/unpin adds/removes from array; pinned apps appear first | unit | `npm test` | ❌ Wave 0 — extend `src/__tests__/configMutations.test.ts` with pin/unpin cases |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/sidebarResize.test.ts` — snap threshold logic (< 80px → iconOnly, > 80px → fullMode), clamp to [120, 300]
- [ ] `src/__tests__/configMutations.test.ts` — add `pinApp` / `unpinApp` mutation tests once those mutations are implemented

*(Animation-only requirements PLSH-01, PLSH-03, SIDE-02 are visual-only and have no automated test path. They are verified during manual QA.)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/components/Sidebar.tsx`, `src/App.tsx`, `src/hooks/useAppsConfig.ts`, `src/hooks/useNotifications.ts`, `src/types.ts`, `src-tauri/src/config.rs`, `src-tauri/src/state.rs`, `src-tauri/src/commands/webview.rs`
- `package.json` — confirmed `motion` is NOT yet installed
- `.planning/phases/07-polish-sidebar/07-CONTEXT.md` — locked decisions
- `.planning/research/SUMMARY.md` — v2.0 architecture decisions and pitfalls
- MDN Web API — Pointer Events / `setPointerCapture` — pointer capture behavior verified

### Secondary (MEDIUM confidence)
- https://motion.dev/docs/react-animate-presence — AnimatePresence API (verified from v2.0 research summary citing same URL)
- https://motion.dev/docs/react-transitions — per-phase transition duration override
- https://motion.dev/docs/react-use-animate — `useAnimate` for imperative animations
- `@tauri-apps/api` getVersion — inferred from Tauri 2 docs pattern; package already installed

### Tertiary (LOW confidence — needs validation)
- App switch crossfade overlay approach: the exact interaction between DOM animation overlay and native webview compositing has not been tested in this codebase. The `set_active_webview_dimmed` mechanism (already used for palette) provides the compositing layer; confirming it works for crossfade is a dev-environment spike.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — motion/react confirmed as project-standard from v2.0 research; pointer capture API is MDN-verified; all other libraries already in package.json
- Architecture: HIGH — based on direct codebase inspection; all integration points mapped to specific file+line locations
- Pitfalls: HIGH — pitfalls 1-4 are derived from reading the actual code paths; pitfalls 5-7 are verified patterns from v2.0 research

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (motion API is stable; Tauri 2.x stable)

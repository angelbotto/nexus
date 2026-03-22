# Phase 7: Polish & Sidebar - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Nexus feels refined — smooth transitions on sidebar, palette, and app switching. Sidebar becomes resizable with icon-only mode, gains a favorites section and a toggle button. Numeric unread count replaces the dot badge. Settings panel shell ready for Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Animation: Sidebar open/close
- Slide + fade: translateX(-100%→0) + opacity(0→1) on open, reverse on close
- Duration: 150ms open (ease-out), 120ms close (ease-in)
- Content area smoothly expands/contracts alongside

### Animation: Command palette
- Scale up + fade: scale(0.95→1) + opacity(0→1) on open
- Backdrop dims simultaneously: opacity(0→0.5)
- Duration: 120ms open (ease-out), 80ms close (ease-in)

### Animation: App switching
- Crossfade only: outgoing opacity 1→0 (60ms), incoming opacity 0→1 (80ms), simultaneous
- No movement, no scale — pure opacity to stay under 100ms performance contract
- This is the most performance-sensitive animation

### Animation: Badge count change
- Subtle scale bump: scale(1→1.2→1) over 200ms when count changes
- Like iOS badge bounce — draws attention without being flashy

### Sidebar resize
- Invisible edge handle (4px hit zone), cursor changes to col-resize on hover
- On drag: subtle 1px white/10 line appears at the edge
- Two distinct modes: full mode (120-300px, default 200px) and icon-only mode (48px fixed)
- Auto-collapse: dragging below ~80px snaps to icon-only (48px), dragging wider snaps back to full mode
- Sidebar width persisted in config

### Sidebar toggle button
- Dedicated chevron button at the very bottom of the sidebar
- Click toggles between full and collapsed (icon-only) modes
- Always visible in both modes

### Favorites section
- Pinned apps sit at the very top of the sidebar, above all groups
- Separated from groups by a thin 1px line — no "Favorites" header (position IS the distinction)
- Pin/unpin via right-click context menu: "Pin to Favorites" / "Unpin from Favorites"
- No limit on number of pinned favorites
- Persists across all spaces (when Spaces ships in Phase 8)

### Numeric badge
- Replace dot badge with numeric count parsed from page title prefix: "(3) Gmail" → shows "3"
- If title has no number but has activity, show dot (fallback)
- Scale bump animation on count change

### Settings panel shell
- Slide-in panel from right edge, ~350px wide, overlays part of the webview area
- Close: X button or click outside the panel
- Access via: gear icon at bottom of sidebar (next to toggle button) + Cmd+K "Open Settings" + Cmd+, shortcut
- Shell content: section headers (Appearance, Sidebar, About) with "Coming in a future update" placeholder. About section shows version + GitHub link.

### Claude's Discretion
- Exact easing curves and animation library integration (motion/react)
- Badge number font size and styling
- Settings panel animation (slide-in duration, easing)
- Icon-only mode: whether to show badges/bell next to small icons
- How to handle resize during animation (debounce/throttle)

</decisions>

<specifics>
## Specific Ideas

- All animations use only `opacity` and `transform` — never animate `width` or `height` to avoid layout thrash
- Arc browser is the primary reference for sidebar toggle, resize, and favorites behavior
- Settings panel bottom bar: gear icon (left) + toggle chevron (right), consistent Arc aesthetic

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Sidebar.tsx — existing sidebar with groups, drag & drop, bell icon, badge dot
- CommandPalette.tsx — existing palette with backdrop dim
- useAppsConfig.ts — config state, switchApp, toggleMute, file watcher
- Tailwind v4 @theme block in index.css for custom tokens
- Context menu infrastructure from Phase 3 — extend with "Pin to Favorites"

### Established Patterns
- Sidebar toggle via Cmd+B already works (toggles sidebarCollapsed in config)
- Badge dot rendering in SortableAppItem (hasBadge && !isActive)
- dnd-kit for drag & drop — PointerSensor with distance:5 activation constraint

### Integration Points
- Sidebar width needs to propagate to Rust (calc_webview_rect uses sidebar_visible boolean, needs width)
- Settings panel sits in App.tsx alongside Sidebar and webview area
- Favorites (pinnedAppIds) added to NexusConfig, persisted via save_config
- motion/react wraps existing components for animations

</code_context>

<deferred>
## Deferred Ideas

- Keyboard shortcut customization — v3 feature
- Sidebar position (left vs right) — not in scope
- Multiple sidebar styles (minimal, detailed, compact) — v3 polish

</deferred>

---

*Phase: 07-polish-sidebar*
*Context gathered: 2026-03-22*

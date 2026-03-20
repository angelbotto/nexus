# Phase 4: Performance & Activity - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Nexus meets its performance contract — sub-1s startup, instant switching between cached apps, under 500 MB RAM with 10 active webviews. LRU pool evicts least-recently-used webviews when pool is full. Inactive apps show a dot badge when their page title changes.

</domain>

<decisions>
## Implementation Decisions

### Activity badge (dot)
- Small white dot (6px) next to the app name in the sidebar — monocromatic, consistent with existing gray/white aesthetic
- Appears when a background app's page title changes (e.g., Gmail shows new message count)
- Auto-clears when the user visits the app (click or Cmd+N)
- Only for background apps — the active app never shows a badge

### LRU pool eviction UX
- Silencioso — cuando una app es evictada del pool y el usuario la visita de nuevo, simplemente recarga sin notificación
- No spinner, no "Reloading..." message — el usuario solo ve el loading natural de la página
- La sesión se mantiene (data_store_identifier preserva cookies/login)

### Claude's Discretion
- LRU pool size (how many webviews to keep alive before evicting)
- Startup optimization strategy (currently webviews are lazy — created on first click)
- Performance measurement approach (how to validate sub-1s startup, <100ms switching, <500MB RAM)
- Title change detection mechanism (MutationObserver on <title> via evaluate_script, or polling)
- How to benchmark and validate the performance contract
- set_memory_usage_level(Low) on evicted webviews vs destroying them entirely
- Whether to keep webview in memory but hidden vs fully destroying and recreating

</decisions>

<specifics>
## Specific Ideas

- Badge must be white dot to maintain monocromatic Arc aesthetic — no blue/red/green notification colors
- Eviction should be invisible to the user — the goal is to save RAM without the user noticing

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state.rs` AppState with `webviews_created: HashSet<String>` — extend to track LRU order
- `switch_app_impl` — already handles create/show/hide webviews, extend for LRU eviction
- `Sidebar.tsx` SortableAppItem — add badge dot rendering
- `useAppsConfig.ts` — add badge state tracking
- Child webviews via `add_child()` with `data_store_identifier` — sessions survive eviction/recreation

### Established Patterns
- Rust→React events via `main_wv.eval("window.dispatchEvent(new CustomEvent(...))")`
- Global shortcuts in Rust lib.rs
- Config persistence via save_config IPC
- Webview creation with cornerRadius via objc2

### Integration Points
- `switch_app_impl` is where LRU tracking and eviction logic goes
- Title change detection needs to inject JS into each child webview (MutationObserver)
- Badge state needs to flow from Rust (title change detected) → React (sidebar renders dot)

</code_context>

<deferred>
## Deferred Ideas

- Preferencias personalizables (border-radius, colors, gap) — future phase
- Botón toggle sidebar en el sidebar — future phase
- Botón de configuración/settings — future phase

</deferred>

---

*Phase: 04-performance-activity*
*Context gathered: 2026-03-19*

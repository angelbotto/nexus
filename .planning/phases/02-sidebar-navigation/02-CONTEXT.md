# Phase 2: Sidebar & Navigation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The primary user-facing surface is complete — users can navigate between all their apps using the sidebar or keyboard shortcuts, toggle sidebar visibility, and see which app is active, all with the Arc-inspired dark mode aesthetic. Apps are visually grouped under collapsible group labels.

</domain>

<decisions>
## Implementation Decisions

### Estética Arc dark mode
- Sidebar fondo casi negro (#111117 / custom darker than gray-900), main area bg-gray-950. Contraste sutil entre ambos
- Monocromático puro — sin accent color. Active = bg-white/10 + text-white. Hover = bg-white/5. Inactive = text-gray-400
- Webview con bordes redondeados (rounded-lg) y gap/margen visible alrededor — efecto "card flotante" tipo Arc. El fondo oscuro de la ventana se ve entre sidebar y webview
- Sin separador explícito entre sidebar y contenido — la diferencia de tono y el gap del webview card crean la separación
- Sin título "Nexus" en el header del sidebar — solo apps. Más espacio, estilo Arc

### Grupos colapsables
- Grupos con header de texto pequeño uppercase + chevron que rota al colapsar. Click en header para toggle
- Estado collapsed/expanded se persiste en apps.json — campo `collapsed` en cada objeto de grupo
- Grupo "Other" (apps sin grupo válido): sin header, siempre visible, apps sueltas al final del sidebar
- Default al primer inicio: todos los grupos expandidos (collapsed: false)

### Collapse del sidebar (Cmd+B)
- Sidebar desaparece completamente al colapsar — webview ocupa toda la ventana (fullscreen)
- Estado collapsed del sidebar se persiste entre reinicios (en apps.json)
- Sin animación de transición — aparece/desaparece instantáneamente
- Sin auto-show por hover — solo Cmd+B para toggle

### Indicadores visuales
- App activa: bg-white/10 + text-white. Sin borde lateral, sin glow
- Hover: bg-white/5 sutil para indicar interactividad
- Sin números de shortcut (Cmd+1-9) en el sidebar — interfaz limpia

### Keyboard shortcuts (Cmd+1-9, Cmd+B, Cmd+R)
- Todos registrados en Rust via global_shortcut (decisión Phase 1 — app webviews roban focus)
- Cmd+R recarga webview activo sin feedback visual — recarga silenciosa como browser normal
- Cmd+1-9 salta a app por posición global (no por grupo)

### Startup behavior
- Al abrir Nexus, cargar automáticamente la última app usada (persistir `lastActiveAppId` en apps.json)
- Si es primera vez o la app ya no existe en config, mostrar empty state

### Favicon fallback
- Google Favicon API sin caché local — fetch cada vez (CDN-cached, suficiente para v1)
- Si el favicon no carga: mostrar primera letra del nombre en círculo gris como fallback

### Claude's Discretion
- Tamaño exacto del gap/margen alrededor del webview card
- Border radius exacto del webview card
- Tipografía y spacing del sidebar
- Implementación del chevron de grupos (SVG inline, Lucide, etc.)
- Cómo persistir sidebar collapsed state en apps.json (campo top-level o nested)
- Exact colors para el fondo del sidebar (#111117 u otro valor custom)

</decisions>

<specifics>
## Specific Ideas

- "Similar a Arc el sidebar y embebido está el webview con círculos redondos que se vea bien top, bien Arc, bien aesthetic"
- El webview debe sentirse como una card flotante sobre el fondo oscuro de la ventana — Arc's signature look
- El sidebar debe fundirse con el fondo de la ventana, no sentirse como un panel separado

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Sidebar.tsx`: Lista plana con favicon + nombre, active state highlight. Necesita refactoring para agregar grupos, collapse, estilo Arc
- `useAppsConfig.ts`: Hook con config, activeAppId, switchApp, file watcher. Extensible para persistir lastActiveAppId y group collapse state
- `types.ts`: AppConfig, GroupConfig, NexusConfig interfaces. GroupConfig necesita campo `collapsed`
- `App.tsx`: Flex layout con sidebar + main area. Necesita lógica de sidebar toggle y webview card styling
- `routing.rs`: Domain extraction, OAuth detection — completo, no necesita cambios
- `commands/webview.rs`: switch_app IPC — necesita comando reload_webview para Cmd+R
- `config.rs`: NexusConfig/GroupConfig structs — necesita campo collapsed en GroupConfig + lastActiveAppId en NexusConfig

### Established Patterns
- IPC via `invoke()` desde React → Rust `#[tauri::command]`
- Estado en `Mutex<AppState>` administrado por Tauri
- File watcher frontend-owned con 300ms debounce
- Google Favicon API en `https://www.google.com/s2/favicons?domain=X&sz=32`
- Tailwind CSS v4 con clases utility, dark palette (gray-900, gray-950, gray-700)

### Integration Points
- `apps.json` necesita nuevos campos: `collapsed` en groups, `lastActiveAppId` top-level, `sidebarCollapsed` top-level
- Global shortcuts se registran en Rust `lib.rs` setup — nuevo código para Cmd+1-9, Cmd+B, Cmd+R
- Webview card styling es CSS puro en el React shell — no afecta WebviewWindows de Tauri

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-sidebar-navigation*
*Context gathered: 2026-03-19*

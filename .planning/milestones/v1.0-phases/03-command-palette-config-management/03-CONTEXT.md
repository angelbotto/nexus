# Phase 3: Command Palette & Config Management - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage their app list entirely from within Nexus — adding, removing, and reordering apps without editing JSON manually — and can switch to any app instantly via the command palette. Includes native macOS context menus and menu bar.

</domain>

<decisions>
## Implementation Decisions

### Command Palette (Cmd+K)
- Overlay centrado en la parte superior de la ventana (Spotlight-style), fondo dimmed detrás
- Dos modos: texto normal = fuzzy search de apps (switch). Prefijo '>' = acciones (Add new app, Remove current app, Reload page, Toggle sidebar)
- Navegación con Arrow keys + Enter. Tab para autocompletar
- Se cierra con Escape, click fuera del overlay, o al seleccionar una acción/app
- Registrar Cmd+K como global shortcut en Rust (mismo patrón que Cmd+B/R)

### Agregar app
- Campos: solo URL + nombre. Grupo se asigna después o va a "Other". ID auto-generado del nombre
- Flujo inline en el command palette: al seleccionar '> Add new app', el palette cambia a mini formulario con campos URL y nombre
- Al agregar, se guarda inmediatamente en apps.json via save_config y aparece en el sidebar

### Eliminar app
- Dos caminos: right-click en sidebar → "Remove" O desde palette '> Remove [app name]'
- Sin confirmación — eliminar inmediatamente. Fácil de re-agregar
- Si se elimina la app activa: cerrar su webview y mostrar empty state

### Sidebar context menu (right-click)
- Menu nativo macOS (Tauri menu API), no CSS custom
- Opciones: Open, Reload, (separador), Edit..., Remove
- "Edit..." abre formulario para cambiar nombre/URL de la app (inline en palette o mini dialog)

### Drag & drop reorder
- Apps se pueden arrastrar entre grupos (no solo dentro del mismo grupo)
- Grupos completos también se pueden reordenar (drag del header)
- Indicador visual: línea horizontal entre items + item arrastrado semi-transparente (50% opacity)
- Cambios se persisten inmediatamente en apps.json via save_config

### Menu bar nativo macOS
- Menu bar mínimo: Nexus (About/Quit), File (Add App Cmd+N), View (Toggle Sidebar Cmd+B, Reload Cmd+R)
- Solo para que los shortcuts aparezcan documentados en el menú del sistema

### Claude's Discretion
- Librería de fuzzy search para el palette (fuse.js o similar)
- Librería de drag & drop (dnd-kit, react-beautiful-dnd, o nativa HTML5)
- Exact styling del command palette overlay (width, border-radius, shadow)
- Cómo implementar el formulario "Edit..." (inline en palette vs mini popover)
- Tauri Menu API specifics para context menus nativos

</decisions>

<specifics>
## Specific Ideas

- El command palette debe sentirse como Spotlight/Raycast — rápido, keyboard-first, centrado arriba
- '>' como prefijo para acciones es familiar para usuarios de VS Code
- Context menus nativos de macOS para que se sienta como una app nativa, no una web app

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `save_config` IPC command — ya existe para persistir cambios en apps.json
- `switch_app_impl` — función pública en Rust, callable desde shortcuts y IPC
- `useAppsConfig.ts` — hook con config state, switchApp, file watcher. Extensible para add/remove/reorder
- Global shortcut registration pattern en lib.rs — agregar Cmd+K siguiendo el mismo patrón
- eval() CustomEvent pattern para Rust→React communication

### Established Patterns
- IPC via invoke() desde React → Rust
- Eventos Rust→React via main_wv.eval("window.dispatchEvent(new CustomEvent(...))")
- Config changes: modify in Rust → save_config → file watcher triggers React reload
- Sidebar rendering: grouped apps with collapsible headers in Sidebar.tsx
- Tailwind CSS v4 dark theme, bg-[#111117]

### Integration Points
- Command palette es un nuevo React component overlay sobre el main window
- Context menus nativos se registran via Tauri Menu API en Rust
- Drag & drop modifica el array de apps/groups en config y llama save_config
- Menu bar se configura en lib.rs setup() o tauri.conf.json

</code_context>

<deferred>
## Deferred Ideas

- Preferencias personalizables (border-radius, bg color, gap del webview) — nueva phase
- Botón toggle sidebar en el sidebar (como Arc tiene al bottom) — nueva phase
- Botón de configuración/settings en sidebar — nueva phase

</deferred>

---

*Phase: 03-command-palette-config-management*
*Context gathered: 2026-03-19*

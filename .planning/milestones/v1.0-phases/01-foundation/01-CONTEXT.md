# Phase 1: Foundation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A working Tauri 2 app with locked-in architecture: file-based config loads and saves from `~/.nexus/apps.json`, each app gets a session-isolated WebviewWindow, external links open in the system browser, and the IPC boundary between the React shell and Rust core is stable. Builds and runs on macOS arm64.

</domain>

<decisions>
## Implementation Decisions

### Config schema (apps.json)
- Schema mínimo por app: `id`, `name`, `url`, `group` — nada más
- Favicon se extrae automáticamente de la URL de cada app (no campo icon manual)
- Sección separada `groups` define orden y display name de los grupos; las apps referencian el group id
- Apps sin grupo válido van a un grupo automático "Other" al final del sidebar
- Hot reload: file watcher activo detecta cambios en apps.json y actualiza el sidebar inmediatamente

### Links externos
- "Externo" = dominio diferente al dominio base de la app; subdominios del mismo dominio se quedan dentro del webview
- Flujos OAuth (accounts.google.com, login.microsoftonline.com, etc.) se permiten dentro del webview para no romper autenticación
- Popups/window.open: mismo dominio dentro del webview, dominio diferente (no OAuth) al browser del sistema
- Sin feedback visual al abrir link externo — comportamiento silencioso

### Sidebar Phase 1
- Funcional básico: lista plana de apps con favicon + nombre, click para cambiar webview
- Sin grupos visibles, sin collapse, sin dark mode pulido, sin shortcuts — todo eso es Phase 2
- Ancho fijo del sidebar (no redimensionable)
- Webviews se crean al primer click, no al inicio — mantenerlos vivos una vez creados

### First-run experience
- Si no existe `~/.nexus/apps.json`, Nexus lo crea automáticamente con apps de ejemplo
- Default config incluye 2 grupos ("Mis Productos", "Tools") y 4 apps (Linear, Plane, Gmail, GitHub)

### Claude's Discretion
- Favicon fetching strategy (cómo extraer/cachear favicons)
- Heurística para detectar flujos OAuth vs links externos normales
- Estructura interna del IPC boundary (comandos Tauri, event system)
- Sidebar styling básico (solo funcional, no necesita ser bonito)
- Error handling para config inválido o corrupto

</decisions>

<specifics>
## Specific Ideas

- Default apps.json debe incluir plane.botto.is en el grupo "Mis Productos" — es una app propia del usuario
- El esquema de grupos con sección separada permite que Phase 2 agregue metadata (colapsado/expandido) sin cambiar la estructura base

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Ninguno — proyecto greenfield, no existe código aún

### Established Patterns
- Ninguno — las convenciones se establecerán en esta phase

### Integration Points
- `~/.nexus/apps.json` es el punto de integración central entre config y UI
- IPC boundary entre React shell y Rust backend es la interfaz que todas las phases posteriores consumirán

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-18*

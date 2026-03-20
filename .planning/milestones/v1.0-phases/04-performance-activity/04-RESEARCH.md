# Phase 4: Performance & Activity - Research

**Researched:** 2026-03-19
**Domain:** Tauri 2 multi-webview lifecycle management, LRU eviction, title-change detection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Activity badge: small white dot (6px) next to app name in sidebar — monochromatic, consistent with gray/white aesthetic
- Badge appears when a background app's page title changes
- Badge auto-clears when user visits the app (click or Cmd+N shortcut)
- Active app never shows a badge
- LRU eviction is silent — evicted app simply reloads naturally when revisited (no spinner, no message)
- `data_store_identifier` preserves session/cookies across eviction and recreation

### Claude's Discretion
- LRU pool size (how many webviews to keep alive before evicting)
- Startup optimization strategy (webviews already lazy — created on first click)
- Performance measurement approach (how to validate sub-1s startup, <100ms switching, <500MB RAM)
- Title change detection mechanism (MutationObserver on `<title>` via `eval` / `initialization_script`, or polling)
- How to benchmark and validate the performance contract
- `set_memory_usage_level(Low)` on evicted webviews vs destroying them entirely
- Whether to keep webview in memory but hidden vs fully destroying and recreating

### Deferred Ideas (OUT OF SCOPE)
- Customizable preferences (border-radius, colors, gap) — future phase
- Sidebar toggle button — future phase
- Settings button — future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WEB-02 | Webviews use lazy loading — only created on first visit, not at startup | Already partially implemented (webviews_created HashSet); need to verify no eager creation at startup |
| WEB-03 | Recently used webviews stay alive (LRU cache), inactive ones are unloaded | LRU implemented via VecDeque + existing webviews_created HashSet; unloading = close() + remove from set |
| WEB-04 | Switching between cached webviews feels instant (no reload) | Existing show/hide pattern already correct; instant switching when webview stays alive in pool |
| VIS-03 | Activity badge (dot) appears on sidebar icon when page title changes | MutationObserver injected via initialization_script on WebviewBuilder; Rust notifies main webview via eval |
| PERF-01 | App starts in under 1 second (cold start) | Tauri + WKWebView already sub-1s on macOS; lazy webview creation ensures no blocking at startup |
| PERF-02 | Switching between cached apps takes < 100ms perceived | show/hide calls are synchronous native ops; 100ms budget is very achievable |
| PERF-03 | RAM stays under 500 MB with 10 active webviews | LRU pool cap (recommendation: 8) + close() on eviction frees WKWebView processes |
</phase_requirements>

---

## Summary

Phase 4 has three independent concerns: lazy startup (WEB-02/PERF-01), LRU pool management (WEB-03/WEB-04/PERF-03), and title-change badges (VIS-03/PERF-02). The existing codebase already implements lazy webview creation correctly — webviews are only created in `switch_app_impl` when `!already_created`. The main work is (1) adding LRU order tracking to `AppState`, (2) evicting the oldest webview via `close()` when the pool exceeds capacity, and (3) injecting a MutationObserver into each child webview at creation time to detect title changes and propagate them to the React sidebar.

The existing communication pattern (Rust evaluates JS on the main webview via `main_wv.eval("window.dispatchEvent(...)")`) is the right approach for badge notifications too. The Tauri Webview API confirms `show()`, `hide()`, `close()`, and `eval()` are all available on the `Webview` struct. No new dependencies are needed for any of these features.

**Primary recommendation:** Extend `AppState` with a `VecDeque<String>` for LRU order. Use `WebviewBuilder::initialization_script` to inject a MutationObserver at webview creation time. Communicate title changes Rust→React via `main_wv.eval(dispatchEvent)`. Close (not hide) evicted webviews to free RAM.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `std::collections::VecDeque` | stdlib | LRU order tracking | push_back on visit, retain on eviction — O(n) but n≤10, fine |
| `tauri::Webview` show/hide/close/eval | Tauri 2.x | Webview lifecycle | Only correct API for child webview control in Tauri 2 |
| `WebviewBuilder::initialization_script` | Tauri 2.x | Inject MutationObserver into child webviews | Runs before page HTML parses; survives navigations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `std::time::Instant` | stdlib | Startup time measurement | Wrap `app.run()` to verify <1s contract |
| `window.performance.now()` | Web API | Switch latency measurement in JS | Measure time from click to `app-switched` event |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `close()` on eviction | `hide()` + memory pressure hint | `hide()` keeps process alive; `close()` actually frees WKWebView process RAM — better for 500MB budget |
| `initialization_script` (injected at creation) | `eval()` after creation | `initialization_script` runs before page JS and survives navigations; `eval()` after creation is a race condition and does not survive SPA route changes |
| `VecDeque<String>` in AppState | external `lru` crate | stdlib is sufficient for pool size ≤10; no extra dependency |

**Installation:** No new dependencies required.

---

## Architecture Patterns

### Recommended Project Structure

No new files required. All changes are in existing files:

```
src-tauri/src/
├── state.rs           # Add lru_order: VecDeque<String>
└── commands/
    └── webview.rs     # Extend switch_app_impl with LRU + title observer injection

src/
├── hooks/
│   └── useAppsConfig.ts   # Add badgeAppIds: Set<string> state
└── components/
    └── Sidebar.tsx         # Render dot badge on SortableAppItem
```

### Pattern 1: LRU Pool in AppState

**What:** `lru_order` is a `VecDeque<String>` holding app IDs in access order (most recent = back). On every switch, move the ID to back. When pool exceeds cap, pop front and close that webview.

**When to use:** Every call to `switch_app_impl`.

```rust
// In state.rs
use std::collections::VecDeque;

pub struct AppState {
    pub config: NexusConfig,
    pub active_app_id: Option<String>,
    pub webviews_created: HashSet<String>,
    pub lru_order: VecDeque<String>,   // NEW: LRU access order
    pub sidebar_visible: bool,
}

pub const LRU_POOL_SIZE: usize = 8;
```

```rust
// In switch_app_impl, after webview creation/show:

// Update LRU order — remove existing entry, push to back
{
    let mut st = state.lock().map_err(|e| e.to_string())?;
    st.lru_order.retain(|id| id != &app_id);
    st.lru_order.push_back(app_id.clone());

    // Evict if over pool cap
    while st.lru_order.len() > LRU_POOL_SIZE {
        if let Some(evicted_id) = st.lru_order.pop_front() {
            st.webviews_created.remove(&evicted_id);
            // close() outside lock to avoid deadlock
            let evicted_label = format!("app-{}", evicted_id);
            if let Some(wv) = app_handle.get_webview(&evicted_label) {
                let _ = wv.close();
            }
        }
    }
}
```

**Critical:** close() must be called outside the Mutex lock. Get the webview handle before locking, or unlock before calling close(). Deadlock is the primary pitfall here.

### Pattern 2: MutationObserver via initialization_script

**What:** Inject JS into every child webview at creation time using `WebviewBuilder::initialization_script`. The observer watches `<title>` mutations and calls back to Rust via `__TAURI_INTERNALS__` — but since child webviews don't have Tauri IPC by default, the correct approach is to have Rust poll or use a different bridge. The recommended bridge is: the MutationObserver sends a postMessage to the parent, but since this is a child webview of a native window (not an iframe), the correct channel is `window.__nexus_title_changed__(appId, newTitle)` which we inject as a native function via `with_webview`.

**Simpler approach (confirmed working in this codebase):** Inject the observer via `initialization_script`. When title changes, the observer calls back via `window.ipc` — but third-party site CSP blocks that. Instead, Rust polls title via `eval` on a timer, or uses a JavaScript-to-Rust bridge.

**Recommended approach:** Use `initialization_script` to inject a MutationObserver that stores the latest title in a known JS variable. Then have Rust poll each background webview's title every 2 seconds via `eval("document.title")`. When a title change is detected for a background webview, notify the main webview via `main_wv.eval(dispatchEvent)`.

```rust
// In WebviewBuilder chain in switch_app_impl:
WebviewBuilder::new(&label, WebviewUrl::External(url))
    .data_store_identifier(store_id)
    .initialization_script(&format!(
        r#"
        (function() {{
            var _lastTitle = document.title;
            var observer = new MutationObserver(function() {{
                if (document.title !== _lastTitle) {{
                    _lastTitle = document.title;
                    // Store for Rust polling
                    window.__nexus_last_title__ = document.title;
                }}
            }});
            observer.observe(document.querySelector('title') || document.documentElement, {{
                subtree: true, characterData: true, childList: true
            }});
        }})();
        "#
    ))
    // ... rest of builder
```

**Alternative (polling from Rust):** Register a Tauri interval (or use `std::thread::spawn`) that every 2s calls `wv.eval("document.title")` for all background webviews. Compare against stored titles in AppState. Fire badge event to main webview on change.

**Better alternative (event-driven, no polling):** Use `initialization_script` to inject a MutationObserver that calls back into a custom IPC endpoint. Since the existing codebase confirmed that `ipc.localhost` is blocked by third-party CSP, the bridge must go through the webview eval channel. The practical solution: store title changes in a JS variable and poll from Rust periodically, OR use `eval` to register a custom handler that sends a fake navigation event Rust can intercept.

**Recommended final approach:** Polling from Rust via a background thread. Every 2 seconds, iterate background webviews and call `wv.eval("document.title")` but eval returns `Result<()>`, not a value. This means Rust cannot read the return value of eval directly.

**Resolution:** Use `main_wv.eval` to inject JS that fires a CustomEvent with the title, then Rust has the main webview forward it back. This is circular. The correct solution for Tauri child webviews reading title back to Rust is:

1. `initialization_script` in child webview registers a MutationObserver
2. When title changes, observer calls a JS function that uses `window.__TAURI_INTERNALS__.transformCallback` to invoke a Rust command — but this requires the webview to have IPC capabilities registered.

**Confirmed working pattern (from existing codebase decisions):** All IPC goes through the main webview. The child webview has no IPC. Solution: child webview's MutationObserver calls `window.parent.postMessage` — but child webviews are not iframes, they are peer native webviews, so postMessage does not apply.

**Definitive approach:** Rust spawns a polling thread. Every 2s per background webview, call `wv.eval(js)` where the JS sets a known global AND simultaneously calls back to main webview using a JS snippet that Rust constructs — no, eval is fire-and-forget.

**Correct Tauri 2 title detection pattern:** Use `initialization_script` + `invoke` from child webview IF the webview has IPC capabilities. The key is adding the child webview label pattern to the capabilities file.

```
// src-tauri/capabilities/default.json — add app-* webviews
{
  "identifier": "default",
  "windows": ["main", "app-*"],   // covers child webviews
  ...
}
```

With IPC capability granted, the child webview can call `invoke("title_changed", { appId, title })` from the MutationObserver, which Rust handles and forwards to the main webview via `main_wv.eval(dispatchEvent)`.

**Note:** Verify capability format for Tauri 2 — confirmed in STATE.md that capabilities require `core:` prefix for some permissions.

### Pattern 3: Badge State in React

**What:** `useAppsConfig` maintains a `Set<string>` of app IDs with pending badge. Cleared on `switchApp`.

```typescript
// In useAppsConfig.ts
const [badgeAppIds, setBadgeAppIds] = useState<Set<string>>(new Set());

// In useEffect, add event listener:
function handleTitleChanged(e: Event) {
  const { appId } = (e as CustomEvent<{ appId: string; title: string }>).detail;
  setBadgeAppIds(prev => {
    const next = new Set(prev);
    next.add(appId);
    return next;
  });
}
window.addEventListener("app-title-changed", handleTitleChanged);

// In switchApp(), clear badge for that app:
setBadgeAppIds(prev => {
  const next = new Set(prev);
  next.delete(id);
  return next;
});
```

```tsx
// In SortableAppItem — add dot badge:
<button ...>
  <img ... />
  <span className="truncate">{app.name}</span>
  {hasBadge && !isActive && (
    <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white" />
  )}
</button>
```

### Anti-Patterns to Avoid

- **Deadlock in LRU eviction:** Never call `wv.close()` while holding the `Mutex<AppState>` lock. Get webview handle first, unlock, then close.
- **Evicting active app:** LRU eviction must skip `active_app_id`. Never evict the currently displayed app.
- **Using HashSet for LRU order:** `HashSet` has no order. Use `VecDeque` alongside it (or replace it).
- **MutationObserver on `<title>` only:** Some SPAs (Gmail, Linear) update `document.title` directly without touching the DOM `<title>` element. Observer target should be `document.documentElement` with `subtree: true` and `childList: true`.
- **Polling all webviews including active one:** Badge only applies to background apps. Skip `active_app_id` when polling/detecting title changes.
- **Badge persisting after switch via keyboard shortcut:** Cmd+1..9 and Cmd+N clear via `switch_app_impl` in Rust, but the React `badgeAppIds` state is only updated from JS `switchApp()`. Rust must dispatch a `app-switched` event (already does) which should also trigger badge clear in the handler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LRU data structure | Custom doubly-linked list | `VecDeque<String>` + `HashSet<String>` | O(n) retain is fine for n=8; stdlib is sufficient |
| CSS dot badge | Canvas, SVG icon, custom component | Tailwind `h-1.5 w-1.5 rounded-full bg-white` | 1 line, matches existing Tailwind v4 patterns |
| Title polling scheduler | Custom timer crate | `std::thread::spawn` + `std::thread::sleep` OR Tauri's `app.run_on_main_thread` | No extra dependency needed |

**Key insight:** All primitives needed already exist in the codebase and stdlib. The complexity is in the wiring, not in novel data structures.

---

## Common Pitfalls

### Pitfall 1: Deadlock in LRU Eviction
**What goes wrong:** Holding `Mutex<AppState>` lock while calling `wv.close()` causes a deadlock if Tauri's close() internally tries to acquire app state.
**Why it happens:** `switch_app_impl` already uses a pattern of locking/unlocking in stages. Adding eviction inside the lock block is dangerous.
**How to avoid:** Collect the evicted app IDs while locked, unlock, then close the webviews. Pattern:
```rust
let evicted_ids: Vec<String> = {
    let mut st = state.lock()...;
    // modify lru_order, collect evicted IDs
    evicted
};
for id in evicted_ids {
    if let Some(wv) = app_handle.get_webview(&format!("app-{}", id)) {
        let _ = wv.close();
    }
}
```
**Warning signs:** App hangs on webview switch after visiting >8 apps.

### Pitfall 2: Evicting the Active App
**What goes wrong:** If pool is full and user rapidly switches, the current active app could theoretically be in the eviction queue.
**Why it happens:** LRU order update and active_app_id update happen in separate lock sections.
**How to avoid:** When evicting, filter out `active_app_id`. Eviction should only affect apps not currently displayed.

### Pitfall 3: MutationObserver Missing SPA Title Updates
**What goes wrong:** Gmail, Linear, Slack update `document.title` via JS assignment without mutating the DOM `<title>` node as a child mutation. A naive observer on `document.querySelector('title')` with `characterData` only would miss these.
**Why it happens:** Setting `document.title = "new"` replaces the text node in some browsers, which is a `childList` mutation, not `characterData`. Also, some SPAs set it on the `document` directly.
**How to avoid:** Observe `document.documentElement` with `{ subtree: true, childList: true, characterData: true }`. Alternatively, read `document.title` after any mutation rather than reading from the mutation record.
**Warning signs:** Gmail badge never appears even when new emails arrive.

### Pitfall 4: Child Webview IPC Capability Not Granted
**What goes wrong:** Injected JS in child webview tries to call `invoke("title_changed", ...)` but fails silently because the child webview label (`app-gmail`, `app-linear`) is not in the capabilities file.
**Why it happens:** Tauri 2 capabilities are allow-listed per webview label.
**How to avoid:** Add `"app-*"` to the `windows` (or `webviews`) array in `src-tauri/capabilities/default.json`. Verify with `tauri info` or check the capabilities JSON directly.
**Warning signs:** No title change events ever reach Rust, even after confirming MutationObserver fires in devtools.

### Pitfall 5: Badge Not Clearing on Keyboard Shortcut Switch
**What goes wrong:** User presses Cmd+3 to switch to an app with a badge. Rust calls `switch_app_impl` which fires `app-switched` CustomEvent. React's `handleAppSwitched` updates `activeAppId` but does NOT clear the badge.
**Why it happens:** Badge clearing is done in `switchApp()` in useAppsConfig but keyboard shortcut goes through Rust → eval → `app-switched` event, not through the JS `switchApp()` function.
**How to avoid:** Clear badge in the `handleAppSwitched` event handler (same place `activeAppId` is updated), not only in `switchApp()`.

---

## Code Examples

### LRU Eviction in switch_app_impl

```rust
// Source: stdlib VecDeque pattern
// After updating webviews_created and active_app_id, run eviction:

const LRU_POOL_SIZE: usize = 8;

// Step 1: update LRU order and collect evicted IDs (while locked)
let evicted_ids: Vec<String> = {
    let mut st = state.lock().map_err(|e| e.to_string())?;
    // Move app_id to back (most recently used)
    st.lru_order.retain(|id| id != &app_id);
    st.lru_order.push_back(app_id.clone());

    let active = st.active_app_id.clone();
    let mut evicted = Vec::new();
    while st.lru_order.len() > LRU_POOL_SIZE {
        if let Some(front) = st.lru_order.pop_front() {
            // Never evict active app
            if active.as_deref() != Some(front.as_str()) {
                st.webviews_created.remove(&front);
                evicted.push(front);
            } else {
                // Put it back and break to avoid infinite loop
                st.lru_order.push_front(front);
                break;
            }
        }
    }
    evicted
};

// Step 2: close evicted webviews (outside lock)
for evicted_id in evicted_ids {
    let label = format!("app-{}", evicted_id);
    if let Some(wv) = app_handle.get_webview(&label) {
        let _ = wv.close();
    }
}
```

### MutationObserver initialization_script

```rust
// Source: Tauri 2 WebviewBuilder::initialization_script
// Inject at webview creation time in switch_app_impl

let app_id_for_script = app_id.clone();
let init_script = format!(r#"
(function() {{
    var _lastTitle = document.title;
    function checkTitle() {{
        if (document.title !== _lastTitle) {{
            _lastTitle = document.title;
            try {{
                window.__TAURI_INTERNALS__.invoke('notify_title_changed', {{
                    appId: '{}',
                    title: document.title
                }});
            }} catch(e) {{}}
        }}
    }}
    var observer = new MutationObserver(checkTitle);
    observer.observe(document.documentElement, {{
        subtree: true, childList: true, characterData: true
    }});
}})();
"#, app_id_for_script);

let child_wv = main_window
    .add_child(
        WebviewBuilder::new(&label, WebviewUrl::External(url))
            .data_store_identifier(store_id)
            .initialization_script(&init_script)
            // ... other handlers
    )
```

### Rust Command: notify_title_changed

```rust
// New IPC command in commands/webview.rs
#[tauri::command]
pub fn notify_title_changed(
    app_id: String,
    title: String,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let is_active = {
        let st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id.as_deref() == Some(app_id.as_str())
    };
    // Only badge for background apps
    if !is_active {
        if let Some(main_wv) = app_handle.get_webview("main") {
            let payload = serde_json::json!({ "appId": app_id, "title": title });
            let _ = main_wv.eval(&format!(
                "window.dispatchEvent(new CustomEvent('app-title-changed', {{ detail: {} }}))",
                payload
            ));
        }
    }
    Ok(())
}
```

### Badge dot in SortableAppItem

```tsx
// Source: existing Tailwind v4 patterns in Sidebar.tsx
// Add hasBadge prop to SortableAppItemProps:
interface SortableAppItemProps {
  app: AppConfig;
  isActive: boolean;
  hasBadge: boolean;  // NEW
  // ...
}

// In the button JSX:
<button className={`flex w-full items-center gap-2.5 ...`} ...>
  <img src={getFaviconUrl(app.url)} alt="" width={16} height={16} className="flex-shrink-0 rounded-sm" />
  <span className="truncate">{app.name}</span>
  {hasBadge && !isActive && (
    <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white opacity-90" />
  )}
</button>
```

### Capabilities file update

```json
// src-tauri/capabilities/default.json
// Add app-* to allow child webviews to invoke IPC commands
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main", "app-*"],
  "permissions": [
    "core:default",
    "core:menu:allow-new",
    ...
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create all webviews at startup | Lazy creation on first visit (already done) | Phase 1 decision | Sub-1s startup |
| HashSet for webview tracking | HashSet for existence + VecDeque for LRU order | Phase 4 (this phase) | RAM budget enforcement |
| No badge | White dot on background apps with title change | Phase 4 (this phase) | Activity awareness |

**Verified existing behavior:**
- Webview lazy creation: CONFIRMED — `switch_app_impl` only calls `add_child` when `!already_created`
- show/hide instant switching: CONFIRMED — `wv.show()` and `wv.hide()` are called in current code
- `data_store_identifier` session persistence: CONFIRMED — will survive close/recreate cycle

---

## Open Questions

1. **Can child webviews invoke Tauri IPC commands after adding `app-*` to capabilities?**
   - What we know: Third-party CSP blocks `ipc.localhost` for navigation, but `window.__TAURI_INTERNALS__.invoke` uses a different mechanism (postMessage to the parent, not a network request)
   - What's unclear: Whether Tauri 2's IPC bridge works in child webviews created via `add_child()` on sites with strict CSP
   - Recommendation: Test with Gmail in Wave 1. If blocked, fall back to a polling approach: Rust uses a spawned thread that periodically calls `wv.eval("document.title")` but since eval returns `()` not a value, use eval to send title to main_wv, which then routes to Rust via IPC.

2. **Polling fallback if IPC is unavailable in child webview**
   - Alternative: inject script stores title in sessionStorage; Rust reads it via eval that sends to main_wv
   - Or: child webview observer fires main_wv.eval via a postMessage to the native window (Tauri 2 may support this)
   - Confidence: LOW — requires empirical testing

3. **LRU pool size: 8 vs 10**
   - WKWebView per instance uses ~30-200MB depending on content (Gmail ~150MB, simple apps ~30MB)
   - 10 webviews * 50MB average = 500MB — right at the budget limit
   - 8 webviews provides headroom: 8 * 50MB = 400MB
   - Recommendation: 8 for the pool cap, matching PERF-03's "under 500MB with 10 active webviews" (10 includes the main shell webview)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vite.config.ts` (empty `test: {}` block) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEB-02 | No webviews created before first switch | unit (state logic) | `npm test` | ❌ Wave 0 |
| WEB-03 | LRU eviction removes oldest webview at pool cap | unit (AppState logic) | `npm test` | ❌ Wave 0 |
| WEB-04 | Switching cached app calls show() not recreate | unit (switch logic) | `npm test` | ❌ Wave 0 (manual verify) |
| VIS-03 | Badge state updates on title-changed event | unit (React hook) | `npm test` | ❌ Wave 0 |
| VIS-03 | Badge clears on app switch (click and keyboard) | unit (React hook) | `npm test` | ❌ Wave 0 |
| PERF-01 | Startup < 1s | manual | `cargo tauri dev` + observe | manual-only |
| PERF-02 | Switch < 100ms perceived | manual | measure via console.time | manual-only |
| PERF-03 | RAM < 500MB with 10 webviews | manual | Activity Monitor | manual-only |

**Note:** PERF-01, PERF-02, PERF-03 are manual-only because they require a running macOS app with real WKWebView processes. They cannot be unit-tested.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual perf check before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/lruState.test.ts` — covers WEB-02, WEB-03 (LRU eviction logic extracted to pure function)
- [ ] `src/__tests__/badgeState.test.ts` — covers VIS-03 (badge set/clear in useAppsConfig logic)
- [ ] Consider extracting LRU eviction to a pure Rust function testable via `cargo test` (no Tauri runtime needed)

---

## Sources

### Primary (HIGH confidence)
- Tauri 2 GitHub source (`tauri-apps/tauri dev` branch) — Webview struct methods: show, hide, close, eval, with_webview, initialization_script
- Existing codebase `src-tauri/src/commands/webview.rs` — confirmed show/hide/close/eval patterns, switch_app_impl structure
- Existing codebase `src-tauri/src/state.rs` — confirmed AppState structure, HashSet for webviews_created
- `std::collections::VecDeque` docs.rs — LRU pattern (push_back, pop_front, retain)
- Existing codebase `src-tauri/Cargo.toml` — confirmed objc2, objc2-app-kit available for platform hooks

### Secondary (MEDIUM confidence)
- STATE.md decision log — confirmed `ipc.localhost` blocked by third-party CSP (Phase 1 decision)
- STATE.md — confirmed `main_wv.eval(dispatchEvent)` as established bridge pattern
- WebSearch: Tauri 2 WebviewBuilder `initialization_script` confirmed available on child WebviewBuilder
- WebSearch: WKWebView per-instance memory 30-200MB range (embrace.io, Apple developer forums)
- WebSearch: MutationObserver `{ subtree: true, childList: true }` for SPA title detection (MDN)

### Tertiary (LOW confidence)
- WebSearch: `set_memory_usage_level(Low)` WKWebView — API exists (confirmed via MBS plugin docs) but actual RAM savings unbenchmarked in Tauri context. Recommendation: use `close()` instead, which definitively frees the process.
- WebSearch: IPC from child webview with `app-*` capability — plausible based on Tauri capability system but requires empirical verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs confirmed in existing codebase and Tauri 2 source
- Architecture (LRU): HIGH — standard Rust stdlib pattern, maps directly to existing switch_app_impl
- Architecture (badge): MEDIUM — initialization_script confirmed; IPC from child webview needs empirical test
- Pitfalls: HIGH — deadlock and active-app eviction are classic patterns; SPA title detection confirmed via MDN
- Performance targets: HIGH — lazy creation already done; show/hide is synchronous native op

**Research date:** 2026-03-19
**Valid until:** 2026-06-01 (Tauri 2 stable; WKWebView APIs stable)

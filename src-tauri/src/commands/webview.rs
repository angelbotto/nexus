use std::sync::Mutex;

use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

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
    st.lru_order.retain(|id| id != &app_id);
    if st.active_app_id.as_deref() == Some(app_id.as_str()) {
        st.active_app_id = None;
    }
    Ok(())
}

#[tauri::command]
pub fn reload_webview(app_id: String, app_handle: AppHandle) -> Result<(), String> {
    let label = format!("app-{}", app_id);
    if let Some(wv) = app_handle.get_webview(&label) {
        wv.eval("location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn reload_active_webview(
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let app_id = {
        let st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id.clone()
    };
    if let Some(id) = app_id {
        let label = format!("app-{}", id);
        if let Some(wv) = app_handle.get_webview(&label) {
            wv.eval("location.reload()").map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

use crate::routing::{extract_base_domain, is_oauth_provider, is_subdomain_of};
use crate::state::{AppState, LRU_POOL_SIZE};

// Sidebar is 220px wide.
const SIDEBAR_WIDTH: f64 = 220.0;
// Gap around the webview for the "floating card" aesthetic.
// macOS: 12px so rounded corners (12px radius) are fully visible.
// Windows/Linux: 0px for edge-to-edge webview (no corner radius).
#[cfg(target_os = "macos")]
const GAP: f64 = 12.0;
#[cfg(not(target_os = "macos"))]
const GAP: f64 = 0.0;
// Top gap below the title bar.
// macOS: 40px for traffic lights + drag region + corner radius.
// Windows/Linux: 12px — native title bar is handled by the OS.
#[cfg(target_os = "macos")]
const GAP_TOP: f64 = 40.0;
#[cfg(not(target_os = "macos"))]
const GAP_TOP: f64 = 12.0;

/// Returns (webview_x, webview_y, webview_width, webview_height) based on actual window size.
pub fn calc_webview_rect(
    main_window: &tauri::Window,
    sidebar_visible: bool,
) -> Result<(f64, f64, f64, f64), String> {
    let size = main_window
        .inner_size()
        .map_err(|e| e.to_string())?;
    let scale = main_window.scale_factor().unwrap_or(1.0);
    let win_w = size.width as f64 / scale;
    let win_h = size.height as f64 / scale;

    let x_offset = if sidebar_visible { SIDEBAR_WIDTH } else { 0.0 };
    let x = x_offset + GAP;
    let y = GAP_TOP;
    let w = win_w - x_offset - GAP * 2.0;
    let h = win_h - GAP_TOP - GAP;
    Ok((x, y, w, h))
}

pub fn switch_app_impl(
    app_id: String,
    app_handle: &AppHandle,
    state: &Mutex<AppState>,
) -> Result<(), String> {
    let (already_created, app_url, prev_app_id, sidebar_visible) = {
        let st = state.lock().map_err(|e| e.to_string())?;
        let already_created = st.webviews_created.contains(&app_id);
        let app_url = st
            .config
            .apps
            .iter()
            .find(|a| a.id == app_id)
            .map(|a| a.url.clone())
            .ok_or_else(|| format!("app '{}' not found in config", app_id))?;
        let prev_app_id = st.active_app_id.clone();
        let sidebar_visible = st.sidebar_visible;
        (already_created, app_url, prev_app_id, sidebar_visible)
    };

    let main_window = app_handle
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let (webview_x, webview_y, webview_width, webview_height) =
        calc_webview_rect(&main_window, sidebar_visible)?;

    if !already_created {
        let label = format!("app-{}", app_id);
        #[cfg(target_os = "macos")]
        let store_id = crate::routing::make_store_id(&app_id);
        let base_domain = extract_base_domain(&app_url);
        let app_url_clone = app_url.clone();
        let base_domain_new_win = base_domain.clone();
        let app_handle_new_win = app_handle.clone();

        let url: tauri::Url = app_url
            .parse()
            .map_err(|e| format!("invalid URL '{}': {}", app_url_clone, e))?;

        let init_script = format!(
            r#"(function() {{
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
}})();"#,
            app_id
        );

        let builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
            .initialization_script(&init_script)
            .on_navigation(move |_nav_url| {
                // Allow all in-page navigations (OAuth, widgets, redirects).
                // External link handling is only on target="_blank" (on_new_window).
                true
            })
            .on_new_window(move |nav_url, _features| {
                use tauri::webview::NewWindowResponse;
                let host = nav_url.host_str().unwrap_or("");
                // Same domain or subdomain → allow in webview
                if host == base_domain_new_win
                    || is_subdomain_of(host, &base_domain_new_win)
                {
                    return NewWindowResponse::Allow;
                }
                // OAuth providers → allow in webview
                if is_oauth_provider(nav_url.as_str()) {
                    return NewWindowResponse::Allow;
                }
                // Different domain target=_blank → open in system browser
                let _ = app_handle_new_win
                    .opener()
                    .open_url(nav_url.as_str(), None::<&str>);
                NewWindowResponse::Deny
            });
        #[cfg(target_os = "macos")]
        let builder = builder.data_store_identifier(store_id);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.data_directory(crate::routing::platform_data_dir(&app_id));

        let child_wv = main_window
            .add_child(
                builder,
                LogicalPosition::new(webview_x, webview_y),
                LogicalSize::new(webview_width, webview_height),
            )
            .map_err(|e| format!("failed to create webview for '{}': {}", app_id, e))?;

        #[cfg(target_os = "macos")]
        child_wv
            .with_webview(|wv| {
                use objc2::runtime::AnyObject;
                use objc2_app_kit::NSView;

                unsafe {
                    let ns_view_ptr = wv.inner() as *mut AnyObject as *mut NSView;
                    if let Some(ns_view) = ns_view_ptr.as_ref() {
                        ns_view.setWantsLayer(true);
                        if let Some(layer) = ns_view.layer() {
                            layer.setCornerRadius(12.0);
                            layer.setMasksToBounds(true);
                        }
                    }
                }
            })
            .map_err(|e| format!("failed to set corner radius for '{}': {}", app_id, e))?;

        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.webviews_created.insert(app_id.clone());
    } else {
        // Show existing webview, reposition to current sidebar state
        let label = format!("app-{}", app_id);
        if let Some(wv) = app_handle.get_webview(&label) {
            wv.set_position(LogicalPosition::new(webview_x, webview_y))
                .map_err(|e| e.to_string())?;
            wv.set_size(LogicalSize::new(webview_width, webview_height))
                .map_err(|e| e.to_string())?;
            wv.show().map_err(|e| e.to_string())?;
        }
    }

    // Hide the previously active webview
    if let Some(prev) = prev_app_id {
        if prev != app_id {
            let prev_label = format!("app-{}", prev);
            if let Some(wv) = app_handle.get_webview(&prev_label) {
                wv.hide().map_err(|e| e.to_string())?;
            }
        }
    }

    // Update active app, track LRU order, and collect evicted IDs
    let evicted_ids: Vec<String> = {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id = Some(app_id.clone());
        // Move app_id to the back (most recently used)
        st.lru_order.retain(|id| id != &app_id);
        st.lru_order.push_back(app_id.clone());
        // Evict oldest entries beyond pool size, never evict the active app
        let mut evicted = Vec::new();
        while st.lru_order.len() > LRU_POOL_SIZE {
            if let Some(candidate) = st.lru_order.pop_front() {
                if st.active_app_id.as_deref() == Some(candidate.as_str()) {
                    // Active app must not be evicted — push it back and stop
                    st.lru_order.push_front(candidate);
                    break;
                }
                st.webviews_created.remove(&candidate);
                evicted.push(candidate);
            }
        }
        evicted
    };

    // Close evicted webviews OUTSIDE the lock to avoid deadlock
    for evicted_id in evicted_ids {
        let label = format!("app-{}", evicted_id);
        if let Some(wv) = app_handle.get_webview(&label) {
            let _ = wv.close();
        }
    }

    // Notify the main (shell) webview about the switch via eval — Tauri events
    // don't reliably reach the main webview when child webviews have focus.
    if let Some(main_wv) = app_handle.get_webview("main") {
        let _ = main_wv.eval(&format!(
            "window.dispatchEvent(new CustomEvent('app-switched', {{ detail: '{}' }}))",
            app_id
        ));
    }

    Ok(())
}

#[tauri::command]
pub fn switch_app(
    app_id: String,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    switch_app_impl(app_id, &app_handle, &state)
}

/// Hides or shows the active child webview so the command palette (rendered in the
/// parent webview) can appear above it. Native child webviews always composite above
/// the parent's DOM, so hiding is the only way to make overlays visible.
#[tauri::command]
pub fn set_active_webview_dimmed(
    dimmed: bool,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref app_id) = st.active_app_id {
        let label = format!("app-{}", app_id);
        if let Some(wv) = app_handle.get_webview(&label) {
            if dimmed {
                wv.hide().map_err(|e| e.to_string())?;
            } else {
                wv.show().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Called by the frontend after toggling the sidebar so the active webview is repositioned.
#[tauri::command]
pub fn resize_active_webview(
    sidebar_visible: bool,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let active_app_id = {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.sidebar_visible = sidebar_visible;
        st.active_app_id.clone()
    };

    if let Some(app_id) = active_app_id {
        let label = format!("app-{}", app_id);
        if let Some(wv) = app_handle.get_webview(&label) {
            let main_window = app_handle
                .get_window("main")
                .ok_or_else(|| "main window not found".to_string())?;
            let (wx, wy, ww, wh) = calc_webview_rect(&main_window, sidebar_visible)?;
            wv.set_position(LogicalPosition::new(wx, wy))
                .map_err(|e| e.to_string())?;
            wv.set_size(LogicalSize::new(ww, wh))
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

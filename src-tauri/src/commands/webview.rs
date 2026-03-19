use std::sync::Mutex;

use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

use crate::routing::{extract_base_domain, is_oauth_provider, is_subdomain_of, make_store_id};
use crate::state::AppState;

// Sidebar is 220px wide.
const SIDEBAR_WIDTH: f64 = 220.0;
// Gap around the webview for the "floating card" effect.
const GAP: f64 = 6.0;
// Extra top gap to account for macOS titlebar overlay area.
const GAP_TOP: f64 = 38.0;

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
        let store_id = make_store_id(&app_id);
        let base_domain = extract_base_domain(&app_url);
        let app_url_clone = app_url.clone();
        let app_handle_nav = app_handle.clone();
        let base_domain_nav = base_domain.clone();
        let app_handle_new_win = app_handle.clone();
        let base_domain_new_win = base_domain.clone();

        let url: tauri::Url = app_url
            .parse()
            .map_err(|e| format!("invalid URL '{}': {}", app_url_clone, e))?;

        let child_wv = main_window
            .add_child(
                WebviewBuilder::new(&label, WebviewUrl::External(url))
                    .data_store_identifier(store_id)
                    .on_navigation(move |nav_url| {
                        let host = nav_url.host_str().unwrap_or("");
                        if host == base_domain_nav || is_subdomain_of(host, &base_domain_nav) {
                            return true;
                        }
                        if is_oauth_provider(nav_url.as_str()) {
                            return true;
                        }
                        let _ =
                            app_handle_nav.opener().open_url(nav_url.as_str(), None::<&str>);
                        false
                    })
                    .on_new_window(move |nav_url, _features| {
                        use tauri::webview::NewWindowResponse;
                        let host = nav_url.host_str().unwrap_or("");
                        if host == base_domain_new_win
                            || is_subdomain_of(host, &base_domain_new_win)
                        {
                            return NewWindowResponse::Allow;
                        }
                        if is_oauth_provider(nav_url.as_str()) {
                            return NewWindowResponse::Allow;
                        }
                        let _ = app_handle_new_win
                            .opener()
                            .open_url(nav_url.as_str(), None::<&str>);
                        NewWindowResponse::Deny
                    }),
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

    // Update active app
    {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id = Some(app_id.clone());
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

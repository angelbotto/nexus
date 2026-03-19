use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::webview::NewWindowResponse;
use tauri_plugin_opener::OpenerExt;

use crate::routing::{extract_base_domain, is_oauth_provider, is_subdomain_of, make_store_id};
use crate::state::AppState;

pub fn switch_app_impl(
    app_id: String,
    app_handle: &AppHandle,
    state: &Mutex<AppState>,
) -> Result<(), String> {
    let (already_created, app_url, prev_app_id) = {
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
        (already_created, app_url, prev_app_id)
    };

    if !already_created {
        let label = format!("app-{}", app_id);
        let store_id = make_store_id(&app_id);
        let base_domain = extract_base_domain(&app_url);
        let app_url_clone = app_url.clone();
        let app_handle_nav = app_handle.clone();

        let url: tauri::Url = app_url
            .parse()
            .map_err(|e| format!("invalid URL '{}': {}", app_url_clone, e))?;

        // Clone for on_navigation closure
        let base_domain_nav = base_domain.clone();

        // Clone app_handle for on_new_window closure
        let app_handle_new_win = app_handle.clone();
        let base_domain_new_win = base_domain.clone();

        WebviewWindowBuilder::new(
            app_handle,
            &label,
            WebviewUrl::External(url),
        )
        .data_store_identifier(store_id)
        .visible(true)
        .on_navigation(move |nav_url| {
            let host = nav_url.host_str().unwrap_or("");
            // Allow same base domain and subdomains
            if host == base_domain_nav || is_subdomain_of(host, &base_domain_nav) {
                return true;
            }
            // Allow OAuth providers
            if is_oauth_provider(nav_url.as_str()) {
                return true;
            }
            // Block everything else — open in system browser
            let _ = app_handle_nav.opener().open_url(nav_url.as_str(), None::<&str>);
            false
        })
        .on_new_window(move |nav_url, _features| {
            let host = nav_url.host_str().unwrap_or("");
            if host == base_domain_new_win || is_subdomain_of(host, &base_domain_new_win) {
                return NewWindowResponse::Allow;
            }
            if is_oauth_provider(nav_url.as_str()) {
                return NewWindowResponse::Allow;
            }
            // Open external URLs in system browser and deny the new window
            let _ = app_handle_new_win.opener().open_url(nav_url.as_str(), None::<&str>);
            NewWindowResponse::Deny
        })
        .build()
        .map_err(|e| format!("failed to create webview for '{}': {}", app_id, e))?;

        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.webviews_created.insert(app_id.clone());
    } else {
        // Show existing webview
        let label = format!("app-{}", app_id);
        if let Some(window) = app_handle.get_webview_window(&label) {
            window.show().map_err(|e| e.to_string())?;
        }
    }

    // Hide the previously active webview
    if let Some(prev) = prev_app_id {
        if prev != app_id {
            let prev_label = format!("app-{}", prev);
            if let Some(window) = app_handle.get_webview_window(&prev_label) {
                window.hide().map_err(|e| e.to_string())?;
            }
        }
    }

    // Update active app
    {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.active_app_id = Some(app_id.clone());
    }

    let _ = app_handle.emit("app-switched", &app_id);

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

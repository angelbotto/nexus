use std::sync::Mutex;

use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

use crate::config;
use crate::state::AppState;

/// Pure guard logic — extracted for unit testing without AppHandle.
/// Returns true if the notification should be sent to the OS.
pub fn should_send(
    active_app_id: Option<&str>,
    app_id: &str,
    muted_app_ids: &[String],
    dnd_enabled: bool,
) -> bool {
    if active_app_id == Some(app_id) {
        return false;
    }
    if muted_app_ids.iter().any(|id| id == app_id) {
        return false;
    }
    if dnd_enabled {
        return false;
    }
    true
}

#[tauri::command]
pub fn send_notification(
    app_id: String,
    _title: String,
    body: String,
    state: State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let (active_app_id, muted_app_ids, dnd_enabled, app_name) = {
        let st = state.lock().map_err(|e| e.to_string())?;
        let app_name = st
            .config
            .apps
            .iter()
            .find(|a| a.id == app_id)
            .map(|a| a.name.clone())
            .unwrap_or_else(|| app_id.clone());
        (
            st.active_app_id.clone(),
            st.config.muted_app_ids.clone(),
            st.config.dnd_enabled,
            app_name,
        )
    };

    if !should_send(
        active_app_id.as_deref(),
        &app_id,
        &muted_app_ids,
        dnd_enabled,
    ) {
        return Ok(());
    }

    app_handle
        .notification()
        .builder()
        .title(&app_name)
        .body(&body)
        .group(&app_id)
        .show()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn toggle_mute_app(
    app_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<String>, String> {
    let updated_muted = {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        if st.config.muted_app_ids.contains(&app_id) {
            st.config.muted_app_ids.retain(|id| id != &app_id);
        } else {
            st.config.muted_app_ids.push(app_id.clone());
        }
        st.config.muted_app_ids.clone()
    };

    persist_config(&state)?;

    Ok(updated_muted)
}

#[tauri::command]
pub fn set_dnd(enabled: bool, state: State<'_, Mutex<AppState>>) -> Result<bool, String> {
    {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.config.dnd_enabled = enabled;
    }

    persist_config(&state)?;

    Ok(enabled)
}

fn persist_config(state: &State<'_, Mutex<AppState>>) -> Result<(), String> {
    let config = {
        let st = state.lock().map_err(|e| e.to_string())?;
        st.config.clone()
    };
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    let path = config::config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_send_skips_active_app() {
        assert!(!should_send(Some("gmail"), "gmail", &[], false));
    }

    #[test]
    fn test_should_send_skips_muted_app() {
        let muted = vec!["gmail".to_string()];
        assert!(!should_send(None, "gmail", &muted, false));
    }

    #[test]
    fn test_should_send_skips_when_dnd_enabled() {
        assert!(!should_send(None, "gmail", &[], true));
    }

    #[test]
    fn test_should_send_proceeds_for_background_unmuted_no_dnd() {
        assert!(should_send(Some("linear"), "gmail", &[], false));
    }

    #[test]
    fn test_should_send_proceeds_when_no_active_app() {
        assert!(should_send(None, "gmail", &[], false));
    }

    #[test]
    fn test_should_send_muted_overrides_background() {
        let muted = vec!["gmail".to_string(), "linear".to_string()];
        // Both are muted — both should be suppressed regardless of active app
        assert!(!should_send(Some("github"), "gmail", &muted, false));
        assert!(!should_send(Some("github"), "linear", &muted, false));
    }

    #[test]
    fn test_should_send_dnd_overrides_everything() {
        // DND suppresses even non-muted background apps
        assert!(!should_send(Some("linear"), "gmail", &[], true));
    }
}

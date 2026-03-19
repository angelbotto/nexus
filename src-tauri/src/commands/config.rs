use std::sync::Mutex;

use tauri::State;

use crate::config::NexusConfig;
use crate::state::AppState;

#[tauri::command]
pub fn load_config(state: State<'_, Mutex<AppState>>) -> Result<NexusConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.config.clone())
}

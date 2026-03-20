use std::sync::Mutex;

use tauri::State;

use crate::config::{self, NexusConfig};
use crate::state::AppState;

#[tauri::command]
pub fn load_config(state: State<'_, Mutex<AppState>>) -> Result<NexusConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.config.clone())
}

#[tauri::command]
pub fn reload_config(state: State<'_, Mutex<AppState>>) -> Result<NexusConfig, String> {
    let path = config::config_path();
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let new_config: NexusConfig =
        serde_json::from_str(&content).map_err(|e| format!("invalid JSON: {e}"))?;
    let mut locked = state.lock().map_err(|e| e.to_string())?;
    locked.config = new_config.clone();
    Ok(new_config)
}

#[tauri::command]
pub fn save_config(config: NexusConfig, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let path = config::config_path();
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    let mut locked = state.lock().map_err(|e| e.to_string())?;
    locked.config = config;
    Ok(())
}

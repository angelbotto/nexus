use std::sync::Mutex;

use tauri::Manager;

mod commands;
mod config;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = config::load_or_create_config();
            app.manage(Mutex::new(AppState::new(config)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::config::load_config,])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

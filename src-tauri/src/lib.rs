use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod commands;
mod config;
mod routing;
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

            let app_handle_sc = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }
                        // Cmd+B -> emit sidebar-toggle to frontend
                        if shortcut.key == Code::KeyB && shortcut.mods == Modifiers::SUPER {
                            app_handle_sc.emit("sidebar-toggle", ()).ok();
                            return;
                        }
                        // Cmd+R -> reload active webview
                        if shortcut.key == Code::KeyR && shortcut.mods == Modifiers::SUPER {
                            let state = app_handle_sc
                                .state::<std::sync::Mutex<crate::state::AppState>>();
                            if let Ok(st) = state.lock() {
                                if let Some(ref app_id) = st.active_app_id {
                                    let label = format!("app-{}", app_id);
                                    if let Some(wv) = app_handle_sc.get_webview_window(&label) {
                                        let _ = wv.eval("location.reload()");
                                    }
                                }
                            }
                            return;
                        }
                        // Cmd+1 through Cmd+9 -> switch to app by position
                        let digit_codes = [
                            Code::Digit1,
                            Code::Digit2,
                            Code::Digit3,
                            Code::Digit4,
                            Code::Digit5,
                            Code::Digit6,
                            Code::Digit7,
                            Code::Digit8,
                            Code::Digit9,
                        ];
                        if let Some(pos) = digit_codes.iter().position(|c| *c == shortcut.key) {
                            if shortcut.mods == Modifiers::SUPER {
                                let state = app_handle_sc
                                    .state::<std::sync::Mutex<crate::state::AppState>>();
                                let app_id = {
                                    let locked = match state.lock() {
                                        Ok(l) => l,
                                        Err(_) => return,
                                    };
                                    locked.config.apps.get(pos).map(|a| a.id.clone())
                                };
                                if let Some(id) = app_id {
                                    let _ = crate::commands::webview::switch_app_impl(
                                        id,
                                        &app_handle_sc,
                                        &state,
                                    );
                                }
                            }
                        }
                    })
                    .build(),
            )?;

            let digit_codes = [
                Code::Digit1,
                Code::Digit2,
                Code::Digit3,
                Code::Digit4,
                Code::Digit5,
                Code::Digit6,
                Code::Digit7,
                Code::Digit8,
                Code::Digit9,
            ];
            for code in digit_codes {
                app.global_shortcut()
                    .register(Shortcut::new(Some(Modifiers::SUPER), code))?;
            }
            app.global_shortcut()
                .register(Shortcut::new(Some(Modifiers::SUPER), Code::KeyB))?;
            app.global_shortcut()
                .register(Shortcut::new(Some(Modifiers::SUPER), Code::KeyR))?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::load_config,
            commands::config::reload_config,
            commands::config::save_config,
            commands::webview::switch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

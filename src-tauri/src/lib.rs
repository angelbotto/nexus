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
                            if let Some(main_wv) = app_handle_sc.get_webview("main") {
                                let _ = main_wv.eval("window.dispatchEvent(new CustomEvent('sidebar-toggle'))");
                            }
                            return;
                        }
                        // Cmd+K -> open command palette
                        if shortcut.key == Code::KeyK && shortcut.mods == Modifiers::SUPER {
                            if let Some(main_wv) = app_handle_sc.get_webview("main") {
                                let _ = main_wv.eval("window.dispatchEvent(new CustomEvent('open-palette'))");
                            }
                            return;
                        }
                        // Cmd+R -> reload active webview (embedded in main window)
                        if shortcut.key == Code::KeyR && shortcut.mods == Modifiers::SUPER {
                            let state = app_handle_sc
                                .state::<std::sync::Mutex<crate::state::AppState>>();
                            if let Ok(st) = state.lock() {
                                if let Some(ref app_id) = st.active_app_id {
                                    let label = format!("app-{}", app_id);
                                    if let Some(wv) = app_handle_sc.get_webview(&label) {
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
            app.global_shortcut()
                .register(Shortcut::new(Some(Modifiers::SUPER), Code::KeyK))?;

            // Resize the active child webview whenever the main window is resized.
            let app_handle_resize = app.handle().clone();
            let main_window = app
                .get_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::Resized(_) = event {
                    let state = app_handle_resize
                        .state::<std::sync::Mutex<crate::state::AppState>>();
                    let (active_app_id, sidebar_visible) = {
                        match state.lock() {
                            Ok(st) => (st.active_app_id.clone(), st.sidebar_visible),
                            Err(_) => return,
                        }
                    };
                    if let Some(app_id) = active_app_id {
                        let label = format!("app-{}", app_id);
                        if let Some(wv) = app_handle_resize.get_webview(&label) {
                            if let Some(win) = app_handle_resize.get_window("main") {
                                if let Ok((wx, wy, ww, wh)) =
                                    crate::commands::webview::calc_webview_rect(
                                        &win,
                                        sidebar_visible,
                                    )
                                {
                                    let _ = wv.set_position(
                                        tauri::LogicalPosition::new(wx, wy),
                                    );
                                    let _ = wv.set_size(tauri::LogicalSize::new(ww, wh));
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::load_config,
            commands::config::reload_config,
            commands::config::save_config,
            commands::webview::switch_app,
            commands::webview::resize_active_webview,
            commands::webview::destroy_webview,
            commands::webview::reload_active_webview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

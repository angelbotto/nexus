use std::sync::Mutex;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod commands;
mod config;
mod routing;
mod state;

use state::AppState;

#[cfg(target_os = "macos")]
fn cmd_modifier() -> Modifiers {
    Modifiers::SUPER
}
#[cfg(not(target_os = "macos"))]
fn cmd_modifier() -> Modifiers {
    Modifiers::CONTROL
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = config::load_or_create_config();
            app.manage(Mutex::new(AppState::new(config)));

            // Set window background to match the app dark theme (#111117)
            if let Some(main_window) = app.get_window("main") {
                let _ = main_window
                    .set_background_color(Some(tauri::window::Color(0x11, 0x11, 0x17, 0xFF)));
            }

            // Native macOS menu bar
            let nexus_menu = SubmenuBuilder::new(app, "Nexus")
                .about(None)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let add_app_item = MenuItemBuilder::new("Add App")
                .accelerator("CmdOrCtrl+N")
                .id("add-app")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&add_app_item)
                .build()?;

            let toggle_sidebar_item = MenuItemBuilder::new("Toggle Sidebar")
                .accelerator("CmdOrCtrl+B")
                .id("toggle-sidebar")
                .build(app)?;

            let reload_item = MenuItemBuilder::new("Reload Page")
                .accelerator("CmdOrCtrl+R")
                .id("reload-page")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&toggle_sidebar_item)
                .item(&reload_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&nexus_menu, &edit_menu, &file_menu, &view_menu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| match event.id().0.as_str() {
                "add-app" => {
                    if let Some(main_wv) = app_handle.get_webview("main") {
                        let _ =
                            main_wv.eval("window.dispatchEvent(new CustomEvent('open-add-app'))");
                    }
                }
                "toggle-sidebar" => {
                    if let Some(main_wv) = app_handle.get_webview("main") {
                        let _ =
                            main_wv.eval("window.dispatchEvent(new CustomEvent('sidebar-toggle'))");
                    }
                }
                "reload-page" => {
                    let active_app_id = {
                        let state = app_handle.state::<std::sync::Mutex<crate::state::AppState>>();
                        state.lock().ok().and_then(|st| st.active_app_id.clone())
                    };
                    if let Some(app_id) = active_app_id {
                        let label = format!("app-{}", app_id);
                        if let Some(wv) = app_handle.get_webview(&label) {
                            let _ = wv.eval("location.reload()");
                        }
                    }
                }
                _ => {}
            });

            let app_handle_sc = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }
                        // Cmd/Ctrl+N -> open add-app form in command palette
                        if shortcut.key == Code::KeyN && shortcut.mods == cmd_modifier() {
                            if let Some(main_wv) = app_handle_sc.get_webview("main") {
                                let _ = main_wv
                                    .eval("window.dispatchEvent(new CustomEvent('open-add-app'))");
                            }
                            return;
                        }
                        // Cmd/Ctrl+B -> emit sidebar-toggle to frontend
                        if shortcut.key == Code::KeyB && shortcut.mods == cmd_modifier() {
                            if let Some(main_wv) = app_handle_sc.get_webview("main") {
                                let _ = main_wv.eval(
                                    "window.dispatchEvent(new CustomEvent('sidebar-toggle'))",
                                );
                            }
                            return;
                        }
                        // Cmd/Ctrl+K -> open command palette
                        if shortcut.key == Code::KeyK && shortcut.mods == cmd_modifier() {
                            if let Some(main_wv) = app_handle_sc.get_webview("main") {
                                let _ = main_wv
                                    .eval("window.dispatchEvent(new CustomEvent('open-palette'))");
                            }
                            return;
                        }
                        // Cmd/Ctrl+R -> reload active webview (embedded in main window)
                        if shortcut.key == Code::KeyR && shortcut.mods == cmd_modifier() {
                            let state =
                                app_handle_sc.state::<std::sync::Mutex<crate::state::AppState>>();
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
                        // Cmd/Ctrl+1 through Cmd/Ctrl+9 -> switch to app by position
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
                            if shortcut.mods == cmd_modifier() {
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
                    .register(Shortcut::new(Some(cmd_modifier()), code))?;
            }
            app.global_shortcut()
                .register(Shortcut::new(Some(cmd_modifier()), Code::KeyB))?;
            app.global_shortcut()
                .register(Shortcut::new(Some(cmd_modifier()), Code::KeyR))?;
            app.global_shortcut()
                .register(Shortcut::new(Some(cmd_modifier()), Code::KeyK))?;
            app.global_shortcut()
                .register(Shortcut::new(Some(cmd_modifier()), Code::KeyN))?;

            // Resize the active child webview whenever the main window is resized.
            let app_handle_resize = app.handle().clone();
            let main_window = app
                .get_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(true) = event {
                    // When window regains focus, switch to the last notified app (if any)
                    let state =
                        app_handle_resize.state::<std::sync::Mutex<crate::state::AppState>>();
                    let pending_app_id = {
                        match state.lock() {
                            Ok(mut st) => st.last_notified_app_id.take(),
                            Err(_) => None,
                        }
                    };
                    if let Some(app_id) = pending_app_id {
                        if let Some(main_wv) = app_handle_resize.get_webview("main") {
                            let js = format!(
                                "window.dispatchEvent(new CustomEvent('switch-to-app', {{ detail: {{ appId: '{}' }} }}))",
                                app_id
                            );
                            let _ = main_wv.eval(&js);
                        }
                    }
                }
                if let tauri::WindowEvent::Resized(_) = event {
                    let state =
                        app_handle_resize.state::<std::sync::Mutex<crate::state::AppState>>();
                    let (active_app_id, sidebar_visible, sidebar_width) = {
                        match state.lock() {
                            Ok(st) => (st.active_app_id.clone(), st.sidebar_visible, st.sidebar_width),
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
                                        sidebar_width,
                                    )
                                {
                                    let _ = wv.set_position(tauri::LogicalPosition::new(wx, wy));
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
            commands::webview::reload_webview,
            commands::webview::set_active_webview_dimmed,
            commands::webview::notify_title_changed,
            commands::notifications::send_notification,
            commands::notifications::toggle_mute_app,
            commands::notifications::set_dnd,
            commands::webview::save_sidebar_width,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

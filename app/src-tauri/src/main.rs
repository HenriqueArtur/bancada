// The shell: a window, and the seam to the core.
//
// Deliberately thin. Everything it can do is in `commands/`, so the
// surface the webview can reach is one folder somebody can read in a
// sitting — which is what the architecture rule about it is protecting.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::attention::attention,
            commands::preview::preview,
            commands::queue::queue,
            commands::review::review,
            commands::setup::settings,
            commands::setup::discover,
            commands::setup::register_project,
            commands::setup::forget_project,
            commands::setup::register_runtime,
            commands::tree::tree,
            commands::tree::file
        ])
        .run(tauri::generate_context!())
        .expect("bancada failed to start");
}

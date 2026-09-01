// The shell: a window, and the seam to the core.
//
// Deliberately thin. Everything it can do is in `commands/`, so the
// surface the webview can reach is one folder somebody can read in a
// sitting — which is what the architecture rule about it is protecting.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::queue::queue,
            commands::review::review,
            commands::tree::tree,
            commands::tree::file
        ])
        .run(tauri::generate_context!())
        .expect("bancada failed to start");
}

// The shell: a window, and the seam to the core.
//
// Deliberately thin. Everything it can do is in `commands/`, so the
// surface the webview can reach is one folder somebody can read in a
// sitting — which is what the architecture rule about it is protecting.

use tauri_plugin_window_state::StateFlags;

pub mod commands;
pub mod watch;

/// The window, and the seam to the core.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        // Where the window was and how big it was, across restarts. A
        // supervisor is a window you put somewhere on purpose — beside the
        // terminal, on the second screen — and one that reopens centred at
        // its default size is one you move every morning.
        //
        // Four flags, not all six. `VISIBLE` would let a window that was
        // hidden when you quit come back hidden, with the dock icon the only
        // sign it started; `DECORATIONS` restores a title bar the product
        // never takes away. Neither is a thing anybody meant to save.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .manage(watch::Watching::default())
        // Started once the app exists, because the watcher emits to it.
        .setup(|app| {
            watch::start(&app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            watch::watching,
            commands::attention::attention,
            commands::git::repo,
            commands::git::history,
            commands::git::branches,
            commands::git::commit,
            commands::preview::preview,
            commands::queue::queue,
            commands::review::review,
            commands::review::summary,
            commands::sessions::sessions,
            commands::sessions::chat,
            commands::setup::settings,
            commands::setup::discover,
            commands::setup::register_project,
            commands::setup::forget_project,
            commands::setup::register_runtime,
            commands::tree::tree,
            commands::tree::worktree,
            commands::tree::paths,
            commands::tree::file,
            commands::work::work,
            commands::work::register_workspace,
            commands::work::forget_workspace
        ])
        .run(tauri::generate_context!())
        .expect("bancada failed to start");
}

#[cfg(test)]
mod tests {
    /// The editor needs inline styles, and nothing else does.
    ///
    /// `default-src 'self'` alone is the tighter policy and it silently
    /// destroys the file viewer: Monaco positions every single line with a
    /// `style` attribute and injects its token colours as a `<style>` element
    /// at runtime. Under the strict policy the lines stack on top of one
    /// another, nothing is coloured, and scrolling leaves holes — with no
    /// error anywhere, because a blocked style is not an exception.
    ///
    /// It took three rounds of "it is still broken" to find, so this asserts
    /// it rather than trusting the next person not to tighten it back. The
    /// loosening is narrow on purpose: script, connect, img and font stay
    /// `'self'`, so CSS still cannot reach anywhere to exfiltrate to.
    #[test]
    fn the_policy_still_lets_the_editor_style_itself() {
        let raw = include_str!("../tauri.conf.json");
        let conf: serde_json::Value = serde_json::from_str(raw).expect("tauri.conf.json");
        let csp = conf["app"]["security"]["csp"]
            .as_str()
            .expect("a content security policy");

        assert!(
            csp.contains("style-src") && csp.contains("'unsafe-inline'"),
            "the file viewer renders as stacked, uncoloured lines without it: {csp}"
        );
        // And the loosening stays narrow: the rest is what it was.
        assert!(csp.contains("default-src 'self'"), "{csp}");
        assert!(
            !csp.contains("script-src"),
            "scripts must stay on the default: {csp}"
        );
    }
}

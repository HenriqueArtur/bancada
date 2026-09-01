// The operating system is reached here, at the edge, like the clock and the
// filesystem.
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

/// Something worth interrupting a person for.
#[derive(Debug, serde::Deserialize)]
pub struct Announce {
    pub title: String,
    pub body: String,
}

/// Put the queue where it can be seen without the window being looked at.
///
/// The whole product is an answer to "I cannot keep track", and a window you
/// have to remember to open does not answer it. The badge is the queue's
/// count carried onto the dock; the notification fires only for items that
/// were not there a moment ago.
///
/// Deliberately dumb: *what* is new and *how to say it* are decided in the
/// webview, where they are pure functions with tests. This end only talks to
/// the operating system.
#[tauri::command]
pub fn attention(
    app: tauri::AppHandle,
    waiting: usize,
    announce: Option<Announce>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // `None` rather than `Some(0)`: a badge showing zero is a badge
        // saying something, and nothing is what an empty queue means.
        let count = (waiting > 0).then_some(waiting as i64);
        window.set_badge_count(count).map_err(|e| e.to_string())?;
    }

    if let Some(a) = announce {
        app.notification()
            .builder()
            .title(a.title)
            .body(a.body)
            .show()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

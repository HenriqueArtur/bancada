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
    // The badge first, and its failure does not stop the notification. They
    // fail for different reasons — one is the window, the other is a system
    // daemon with its own opinion about which apps may speak — and losing
    // both because one broke is how a product ends up mute for a reason
    // nobody can name.
    let mut trouble = Vec::new();

    match app.get_webview_window("main") {
        Some(window) => {
            // `None` rather than `Some(0)`: a badge showing zero is a badge
            // saying something, and nothing is what an empty queue means.
            let count = (waiting > 0).then_some(waiting as i64);
            if let Err(e) = window.set_badge_count(count) {
                trouble.push(format!("badge: {e}"));
            }
        }
        None => trouble.push("badge: no window to put it on".to_owned()),
    }

    if let Some(a) = announce
        && let Err(e) = app
            .notification()
            .builder()
            .title(a.title)
            .body(a.body)
            .show()
    {
        // Most often this is macOS refusing an app it does not consider
        // installed. Named rather than swallowed: silence here looks
        // exactly like a quiet queue.
        trouble.push(format!("notification: {e}"));
    }

    if trouble.is_empty() {
        Ok(())
    } else {
        Err(trouble.join(" · "))
    }
}

// The edge again: this is the module that owns a thread and a filesystem
// handle, which is exactly why it is here and not in a crate.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::Cockpit;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::Mutex;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// The event the window listens for.
///
/// It carries nothing. What changed is not knowable from a filesystem event
/// in terms the screens care about — a line landed in some log — and a
/// payload naming a path would invite a screen to believe it knows which of
/// its questions is now stale. Every screen re-asks; the reads are cheap and
/// the correctness is free.
pub const CHANGED: &str = "bancada:changed";

/// How long the window waits for the writing to stop before it re-reads.
///
/// A working session writes several lines a second. Without this the window
/// would re-read several times a second, and each read runs `git diff`.
const SETTLE: Duration = Duration::from_millis(400);

/// Whether the window is hearing about changes or asking for them.
///
/// Named rather than assumed. The comment on `RuntimeError::Unsupported`
/// already says why: a watch that reports nothing is indistinguishable from
/// a tree that is not changing, and a screen that looks live while it is a
/// minute behind lies with more confidence than one that admits it.
#[derive(Debug, Default)]
pub struct Watching {
    /// `None` while nothing has been tried yet.
    pub live: Mutex<Option<bool>>,
}

#[tauri::command]
pub fn watching(state: tauri::State<'_, Watching>) -> Option<bool> {
    *state.live.lock().expect("no thread panicked holding this")
}

/// Start telling the window when a log lands.
///
/// Push rather than poll, and the reasoning is in ADR-022. The short of it:
/// the logs are always a host path — `configDir` is written in this
/// machine's spelling, which is how they are read at all — so watching them
/// never has to cross into a guest, whatever kind of place the project runs
/// in.
///
/// Failure here is not fatal and not silent. The window asks `watching`,
/// finds `false`, and goes back to asking on a timer while saying so.
pub fn start(app: &AppHandle) {
    let live = match spawn(app.clone()) {
        Ok(()) => true,
        Err(why) => {
            // Printed rather than swallowed. This is the one path where the
            // product quietly becomes a worse version of itself, and a line
            // in the log is what makes the "checking every 60s" on screen
            // explainable rather than mysterious.
            eprintln!("bancada: watching failed, falling back to asking: {why}");
            false
        }
    };
    *app.state::<Watching>()
        .live
        .lock()
        .expect("no thread panicked holding this") = Some(live);
}

fn spawn(app: AppHandle) -> Result<(), String> {
    let config = crate::commands::queue::load_config()?;
    let dirs = Cockpit::new(config).watched(&crate::commands::queue::config_path());

    let (tx, rx) = mpsc::channel();
    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(tx).map_err(|e| e.to_string())?;

    let mut watched = 0;
    for dir in &dirs {
        // A directory that does not exist yet is normal: a project with no
        // sessions has no log folder. The rest are still worth watching.
        if watcher.watch(dir, RecursiveMode::Recursive).is_ok() {
            watched += 1;
        }
    }
    if watched == 0 {
        return Err(format!(
            "none of {} directories could be watched",
            dirs.len()
        ));
    }

    std::thread::spawn(move || {
        // The watcher is moved in so it lives as long as the thread. Dropped
        // at the end of `spawn`, it would stop watching the moment it
        // started, and the failure would look exactly like a quiet machine.
        let _keep = watcher;
        let mut last = Instant::now();
        for event in rx {
            if event.is_err() {
                continue;
            }
            // Coalesced by time rather than counted: a burst of thirty lines
            // is one thing happening, and the window only needs to know it
            // happened once.
            if last.elapsed() < SETTLE {
                continue;
            }
            last = Instant::now();
            let _ = app.emit(CHANGED, ());
        }
    });

    Ok(())
}

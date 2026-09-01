// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Diff, Review};
use bancada_runtime::{HostRuntime, Runtime};
use serde::Serialize;
use std::collections::HashMap;

/// One project's uncommitted work, beside what its sessions said they'd do.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewView {
    pub diff: Diff,
    pub sessions: Vec<SessionReview>,
    /// Touched by some session and never announced by any of them.
    ///
    /// Computed across sessions rather than per session, because two agents
    /// working the same tree is exactly the case where a per-session list
    /// lies: the file *was* announced, just not by the one that wrote it.
    pub unannounced: Vec<String>,
    pub unreachable: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionReview {
    pub session: String,
    pub intent: Option<String>,
    pub touched: Vec<String>,
}

/// Pair the tree's changes with the claims made about them.
///
/// `seen` is the caller's memory of what it already reviewed — path to the
/// fingerprint it acknowledged. The product keeps no such record itself: a
/// review is a human act, and storing it here would let a restart silently
/// mark work as read.
#[tauri::command]
pub fn review(project: String, seen: HashMap<String, String>) -> Result<ReviewView, String> {
    let cockpit = Cockpit::new(super::queue::load_config()?);
    let project = cockpit
        .config()
        .projects
        .iter()
        .find(|p| p.id == project)
        .ok_or_else(|| format!("no project registered as {project}"))?;

    // Two runtimes, deliberately. The harness keeps its logs on *this*
    // machine — `configDir` is written in the host's spelling — while the
    // project's tree lives wherever the project runs, and `git -C` has to be
    // asked there. Reading both through one runtime is how a VM project
    // reports "no such directory" about a tree that exists.
    let host = HostRuntime::local();
    let at = cockpit
        .config()
        .runtime_of(project)
        .ok_or_else(|| format!("no runtime registered for {}", project.id))?
        .open();

    let (diff, unreachable) = match cockpit.diff_of(project, &at) {
        Ok(mut d) => {
            d.mark_fresh(&seen);
            (d, None)
        }
        // A tree that is not a git repository is a normal state, not a
        // crash: say so, and still show what the sessions claimed.
        Err(why) => (Diff::default(), Some(why)),
    };

    let mut sessions = Vec::new();
    for log in cockpit.scan(project, &host).logs {
        let Ok(bytes) = host.read_file(&log) else {
            continue;
        };
        let r = Review::of(&String::from_utf8_lossy(&bytes));
        if r.touched.is_empty() && r.intent.is_none() {
            continue;
        }
        sessions.push(SessionReview {
            session: log
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default(),
            intent: r.intent,
            touched: r.touched,
        });
    }

    let announced: Vec<String> = sessions
        .iter()
        .filter_map(|s| s.intent.as_deref())
        .flat_map(|i| Review::of_text(i).announced)
        .collect();
    let unannounced = diff
        .files
        .iter()
        .map(|f| f.path.clone())
        .filter(|p| !announced.iter().any(|a| p.ends_with(a) || a.ends_with(p)))
        .collect();

    Ok(ReviewView {
        diff,
        sessions,
        unannounced,
        unreachable,
    })
}

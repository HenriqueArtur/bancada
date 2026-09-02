// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Diff, Review, Summary};
use bancada_runtime::{HostRuntime, Runtime};
use serde::Serialize;
use std::collections::HashMap;

/// One project's uncommitted work, beside what its sessions said they'd do.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewView {
    pub diff: Diff,
    /// What was said before each stretch of work, newest first.
    pub told: Vec<Told>,
    pub unreachable: Option<String>,
}

/// One turn's claim, and the session it came from.
///
/// A turn and not a session. A session is an afternoon of them, and reading
/// one claim from the whole log freezes it at the first thing ever said.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Told {
    pub session: String,
    pub intent: Option<String>,
    pub touched: Vec<String>,
    /// Milliseconds, so several sessions read in one order.
    pub at: i64,
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

    // How many turns reach the screen. An afternoon is a hundred of them
    // and the recent ones are the only ones whose work is still uncommitted.
    const RECENT: usize = 20;

    let mut told = Vec::new();
    for log in cockpit.scan(project, &host).logs {
        let Ok(bytes) = host.read_file(&log) else {
            continue;
        };
        let session = log
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();

        for e in Review::of(&String::from_utf8_lossy(&bytes)).episodes {
            // Only turns whose work is still in the tree. The rest describe
            // something already committed, and this screen exists to be
            // held against what is in front of you.
            if !e.touched.iter().any(|t| in_diff(&diff, t)) {
                continue;
            }
            told.push(Told {
                session: session.clone(),
                intent: e.intent,
                touched: e.touched,
                at: e.at.as_millis(),
            });
        }
    }

    // Newest first, across sessions. Two agents in one tree are one
    // conversation as far as the reader is concerned.
    told.sort_by_key(|t| std::cmp::Reverse(t.at));
    told.truncate(RECENT);

    Ok(ReviewView {
        diff,
        told,
        unreachable,
    })
}

/// Whether a path the log recorded is one of the files that changed.
///
/// A suffix match because the two are spelled differently: the log writes
/// an absolute path in the guest's spelling, and a diff is relative to the
/// project root. Same reasoning as the announcement matcher next to it.
fn in_diff(diff: &Diff, touched: &str) -> bool {
    diff.files.iter().any(|f| touched.ends_with(&f.path))
}

/// How much has moved, in three numbers.
///
/// Its own command rather than a field of `review`: the footer sits on all
/// four screens, and the tree screen asking for thirty thousand lines of
/// hunks to print "12 files" is the payload mistake this codebase has
/// already made once.
#[tauri::command]
pub fn summary(project: String) -> Result<Summary, String> {
    let cockpit = Cockpit::new(super::queue::load_config()?);
    let project = cockpit
        .config()
        .projects
        .iter()
        .find(|p| p.id == project)
        .ok_or_else(|| format!("no project registered as {project}"))?;
    let at = cockpit
        .config()
        .runtime_of(project)
        .ok_or_else(|| format!("no runtime registered for {}", project.id))?
        .open();

    // A tree git has never been told about is a normal state, not a crash.
    // Nothing changed is the honest answer, and the same one the diff gives.
    Ok(cockpit.summary_of(project, &at).unwrap_or_default())
}

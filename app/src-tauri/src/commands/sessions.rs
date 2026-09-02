// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Chat, Cockpit, Session};
use bancada_runtime::{HostRuntime, Runtime};
use serde::Serialize;

/// One session's last exchange, and whether it is stopped on you.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
    #[serde(flatten)]
    pub session: Session,
    /// Taken from the queue rather than worked out again here. It is the
    /// same fact that lights the dock badge, and two readings of "is this
    /// waiting" is how a product ends up disagreeing with itself.
    pub waiting: bool,
}

/// Every session of one project, newest first.
///
/// Its own command rather than a corner of `review`: this one reads logs and
/// nothing else, while `review` also runs `git diff` and reads files. The
/// screen it feeds is the one that has to be current, and making it pay for
/// a diff it never shows is how a cheap screen becomes an expensive one.
#[tauri::command]
pub fn sessions(project: String) -> Result<Vec<SessionView>, String> {
    let cockpit = Cockpit::new(super::queue::load_config()?);
    let project = cockpit
        .config()
        .projects
        .iter()
        .find(|p| p.id == project)
        .ok_or_else(|| format!("no project registered as {project}"))?;

    // The logs are on *this* machine whatever kind of place the project runs
    // in — `configDir` is written in the host's spelling, which is what makes
    // reading them possible at all.
    let host = HostRuntime::local();
    let now = bancada_meta::Timestamp::from_millis(super::queue::millis_now());

    let mut out = Vec::new();
    for log in cockpit.scan(project, &host).logs {
        let Ok(bytes) = host.read_file(&log) else {
            continue;
        };
        let text = String::from_utf8_lossy(&bytes);
        let id = log
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();

        let session = Session::of(&id, &text);
        // A session that never said or heard anything is a file the harness
        // opened and abandoned. A row for it is a row about nothing.
        if session.said.is_none() && session.heard.is_none() {
            continue;
        }

        let waiting = !Cockpit::queue_of(project, &Cockpit::facts(&text), now).is_empty();
        out.push(SessionView { session, waiting });
    }

    // Waiting first, then by when. The order the queue would put them in,
    // for the same reason: what is stopped on you outranks what is not.
    out.sort_by_key(|s| {
        (
            std::cmp::Reverse(s.waiting),
            std::cmp::Reverse(s.session.at.as_millis()),
        )
    });
    Ok(out)
}

/// How many messages a page of a conversation holds.
const A_PAGE: usize = 40;

/// One session's conversation, newest page first.
///
/// `skip` is how many messages from the end are already on screen. Paged
/// rather than whole for the reason `Chat` says: a log is tens of megabytes,
/// and the screen only ever shows the end of it.
#[tauri::command]
pub fn chat(project: String, session: String, skip: usize) -> Result<Chat, String> {
    // The id names a file, and it arrives from the webview. A `..` in it
    // would read a log belonging to another project — or anything else.
    if session.is_empty()
        || !session
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(format!("{session} is not a session"));
    }

    let cockpit = Cockpit::new(super::queue::load_config()?);
    let project = cockpit
        .config()
        .projects
        .iter()
        .find(|p| p.id == project)
        .ok_or_else(|| format!("no project registered as {project}"))?;
    let dir = cockpit
        .log_dir(project)
        .ok_or_else(|| format!("no runtime registered for {}", project.id))?;

    let host = HostRuntime::local();
    let bytes = host
        .read_file(&dir.join(format!("{session}.jsonl")))
        .map_err(|e| format!("{e:?}"))?;

    Ok(Chat::of(
        &String::from_utf8_lossy(&bytes),
        &project.path,
        skip,
        A_PAGE,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_session_id_that_could_climb_out_of_its_folder_is_refused() {
        // It names a file, and it arrives from the untrusted side of the
        // seam. `../` in it reads a log belonging to somebody else.
        assert!(chat("p".into(), "../../secrets".into(), 0).is_err());
        assert!(chat("p".into(), "a/b".into(), 0).is_err());
        assert!(chat("p".into(), String::new(), 0).is_err());
    }
}

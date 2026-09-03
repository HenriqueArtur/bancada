// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Project};
use bancada_runtime::{Runtime, RuntimeError};

/// What a registration would actually be watching, before it is made.
///
/// Registering a project used to end with a line of encoded directory name
/// for the human to check. That is jargon asking a person to verify
/// something the product can verify itself — so this answers with evidence
/// instead: the tree is there, and there are this many sessions in it.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    /// Sessions the harness has already recorded for this path.
    pub sessions: usize,
    /// Whether the tree itself can be reached at all.
    pub reachable: bool,
    /// Whether it is a git repository, which is what the review half needs.
    pub versioned: bool,
    /// The computed log directory. Shown small, for the case where the
    /// count is zero and somebody wants to know where it looked.
    pub log_dir: String,
    pub why: Option<String>,
}

/// Look before registering.
#[tauri::command]
pub fn preview(path: String, runtime: String) -> Result<Preview, String> {
    let config = super::queue::load_config()?;
    let spec = config
        .runtimes
        .iter()
        .find(|r| r.id == runtime)
        .ok_or_else(|| format!("no runtime registered as {runtime}"))?;

    // A stand-in project, only so the same lossy encoding runs. Computed
    // here exactly as it is computed everywhere else — a second spelling of
    // that rule is a second thing to get wrong.
    let candidate = Project {
        id: "preview".to_owned(),
        workspace: String::new(),
        runtime: runtime.clone(),
        path: path.clone(),
        // Nothing stated: this project exists for one call to
        // `log_dir_name` and no rule will ever read a number off it.
        limits: Default::default(),
        weight: None,
        idle_after_minutes: None,
        muted: None,
        kept: Vec::new(),
    };

    let cockpit = Cockpit::new(config.clone());
    let at = spec.open();
    let log_dir = cockpit
        .log_dir(&candidate)
        .map(|d| d.display().to_string())
        .unwrap_or_default();

    // The tree is reached through the project's runtime; the logs through
    // this machine, because `configDir` is written in the host's spelling.
    let host = bancada_runtime::HostRuntime::local();
    let (reachable, why) = match at.read_dir(std::path::Path::new(&path)) {
        Ok(_) => (true, None),
        Err(RuntimeError::NotFound(_)) => (false, Some("no such directory".to_owned())),
        Err(e) => (false, Some(format!("{e:?}"))),
    };

    let versioned = at
        .exec(&[
            "git".into(),
            "-C".into(),
            path.clone(),
            "rev-parse".into(),
            "--git-dir".into(),
        ])
        .is_ok();

    let scan = cockpit.scan(&candidate, &host);
    Ok(Preview {
        sessions: scan.logs.len(),
        reachable,
        versioned,
        log_dir,
        why: why.or(scan.unreachable),
    })
}

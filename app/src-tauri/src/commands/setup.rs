// Same boundary as `queue`: the filesystem is read *and written* here, at
// the edge. This is the only command that writes anything at all.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Config, Discovery, Muted, Project, RuntimeSpec};
use bancada_runtime::HostRuntime;

/// Everything registered, as the product currently sees it.
#[tauri::command]
pub fn settings() -> Result<Config, String> {
    super::queue::load_config()
}

/// Probe every registered runtime for a harness and an account.
///
/// A separate command from [`settings`] on purpose: probing shells into
/// every VM, which is slow and can hang on a machine that is asleep. The
/// settings screen must open whether or not any of that answers.
#[tauri::command]
pub fn discover() -> Result<Vec<Discovery>, String> {
    let config = super::queue::load_config()?;
    Ok(config
        .runtimes
        .iter()
        .map(|spec| Discovery::probe(spec, &spec.open()))
        .collect())
}

/// Register a project, or replace the one with the same id.
///
/// Replacing rather than refusing: the screen that calls this is also the
/// screen that edits, and two paths for "write this row" is one more than
/// the shape needs.
///
/// `previous` is the name it had before, when this is an edit that renamed
/// it. Without it the old entry stays and the cockpit watches one tree twice
/// under two names.
#[tauri::command]
pub fn register_project(project: Project, previous: Option<String>) -> Result<Config, String> {
    let mut config = super::queue::load_config()?;
    if let Some(before) = previous.filter(|b| *b != project.id) {
        config = config.rename_project(&before, &project.id)?;
    }
    config.projects.retain(|p| p.id != project.id);
    config.projects.push(project);
    config.projects.sort_by(|a, b| a.id.cmp(&b.id));
    save(config)
}

#[tauri::command]
pub fn forget_project(id: String) -> Result<Config, String> {
    let mut config = super::queue::load_config()?;
    config.projects.retain(|p| p.id != id);
    save(config)
}

/// Register a runtime, or replace the one with the same id.
///
/// Discovery **proposes**; this is the act that registers. Nothing probed
/// reaches the queue on its own — forty containers would hide the three
/// that matter.
#[tauri::command]
pub fn register_runtime(runtime: RuntimeSpec) -> Result<Config, String> {
    let mut config = super::queue::load_config()?;
    config.runtimes.retain(|r| r.id != runtime.id);
    config.runtimes.push(runtime);
    config.runtimes.sort_by(|a, b| a.id.cmp(&b.id));
    save(config)
}

/// Write the configuration back, and refuse to write one we could not read.
///
/// The round-trip through `Config::parse` is the check: it re-runs the same
/// validation the product uses at startup, so a write can never leave the
/// cockpit in a state that will not open. A dangling runtime reference is
/// caught here, with the human still looking at the form.
pub(super) fn save(config: Config) -> Result<Config, String> {
    let home = super::queue::home();
    // Written without the machine bancada runs on. Persisting it would
    // freeze today's `$HOME` into a file that outlives it, and the copy on
    // disk would quietly win over the fact. An entry somebody *edited* is no
    // longer the default and stays.
    let stored = config.without_this_machine(&home);

    let text = serde_json::to_string_pretty(&stored).map_err(|e| e.to_string())?;
    let checked = Config::parse_with_home(&text, &home).map_err(|e| format!("{e:?}"))?;

    let path = super::queue::config_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }

    // Written beside the target and renamed over it. A half-written config
    // is a cockpit that will not open, and the crash that produces one
    // always happens to somebody who was mid-edit.
    let tmp = path.with_extension("json.writing");
    std::fs::write(&tmp, format!("{text}\n")).map_err(|e| format!("{}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("{}: {e}", path.display()))?;

    Ok(checked)
}

/// Silence a project, or let it speak again.
///
/// The clock and the session count are read at the edge and written in, the
/// same way the queue reads the time: `Muted` records how much work the
/// project had at the moment you silenced it, because that is what lets a
/// session that did not exist then wake it back up on its own.
#[tauri::command]
pub fn mute_project(id: String, muted: bool) -> Result<Config, String> {
    let mut config = super::queue::load_config()?;
    let host = HostRuntime::local();
    let now = bancada_meta::Timestamp::from_millis(super::queue::millis_now());

    // Counted before the borrow: the scan needs the whole cockpit, and the
    // project about to be edited is inside it.
    let sessions = {
        let cockpit = Cockpit::new(config.clone());
        let project = cockpit
            .config()
            .projects
            .iter()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("no project registered as {id}"))?;
        cockpit.scan(project, &host).logs.len()
    };

    let project = config
        .projects
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("no project registered as {id}"))?;
    project.muted = muted.then_some(Muted { at: now, sessions });
    save(config)
}

/// Keep one session out of reach of the rule that quiets the old ones.
///
/// Opening a session is how you say you have moved on from the last one,
/// and the queue reads it that way. This is the exception: the long-running
/// session that sits idle on purpose and that you do mean to come back to.
///
/// No clock and no scan, unlike [`mute_project`]. A mark on a session is
/// just a name — it says *which*, and there is nothing about the moment it
/// was made that any rule needs to ask later.
#[tauri::command]
pub fn keep_session(project: String, session: String, kept: bool) -> Result<Config, String> {
    let mut config = super::queue::load_config()?;
    let found = config
        .projects
        .iter_mut()
        .find(|p| p.id == project)
        .ok_or_else(|| format!("no project registered as {project}"))?;

    found.kept.retain(|s| *s != session);
    if kept {
        found.kept.push(session);
    }
    save(config)
}

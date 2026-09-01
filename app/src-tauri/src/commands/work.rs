// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Config, Work, Workspace};
use bancada_runtime::HostRuntime;

/// Everything registered, grouped by the boundary it belongs to.
///
/// A project with nothing waiting is invisible in the cockpit, and correctly
/// so — that screen means *act*. This is the other question: what is being
/// watched, whose it is, and is it alive.
#[tauri::command]
pub fn work() -> Result<Work, String> {
    let cockpit = Cockpit::new(super::queue::load_config()?);
    Ok(cockpit.work(&HostRuntime::local()))
}

/// Register a workspace, or replace the one with the same id.
#[tauri::command]
pub fn register_workspace(workspace: Workspace) -> Result<Config, String> {
    super::setup::save(super::queue::load_config()?.with_workspace(workspace))
}

/// Drop a workspace, unless something still belongs to it.
#[tauri::command]
pub fn forget_workspace(id: String) -> Result<Config, String> {
    super::setup::save(super::queue::load_config()?.without_workspace(&id)?)
}

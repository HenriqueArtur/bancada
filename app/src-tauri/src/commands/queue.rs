// The clock and the filesystem are read here, at the edge, and passed inward.
// `SystemTime` and `std::fs` are denied across the workspace so that nothing
// *below* reaches for them — this is the boundary the rule exists to create,
// not a place it was meant to apply.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Config};
use bancada_rules::{Grouped, Wip};
use bancada_runtime::{HostRuntime, Runtime};
use serde::Serialize;
use std::path::PathBuf;

/// What the webview receives.
#[derive(Debug, Serialize)]
pub struct Queue {
    groups: Vec<Grouped>,
    wip: Wip,
    /// How many projects are being read. An empty queue with three
    /// projects watched and an empty queue with none configured are
    /// different states, and they look identical without this.
    watching: usize,
    /// Named rather than silent: a project the product could not read
    /// looks exactly like a project with nothing pending.
    unreachable: Vec<String>,
}

/// Read every registered project and answer what needs the human.
///
/// The clock is read **here**, at the edge, and passed inward. Nothing
/// below this call asks the time, which is what keeps the ranking a pure
/// function and therefore testable.
#[tauri::command]
pub fn queue() -> Result<Queue, String> {
    let config = load_config()?;
    let cockpit = Cockpit::new(config);
    let host = HostRuntime::local();
    let now = bancada_meta::Timestamp::from_millis(millis_now());

    let mut items = Vec::new();
    let mut unreachable = Vec::new();

    for project in &cockpit.config().projects {
        let scan = cockpit.scan(project, &host);
        if let Some(why) = scan.unreachable {
            unreachable.push(format!("{}: {why}", project.id));
            continue;
        }
        for log in scan.logs {
            match host.read_file(&log) {
                Ok(bytes) => {
                    let facts = Cockpit::facts(&String::from_utf8_lossy(&bytes));
                    items.extend(Cockpit::queue_of(project, &facts, now));
                }
                Err(e) => unreachable.push(format!("{}: {e:?}", log.display())),
            }
        }
    }

    let watching = cockpit.config().projects.len();
    let (groups, wip) = Cockpit::present(items, now);
    Ok(Queue {
        groups,
        wip,
        watching,
        unreachable,
    })
}

fn config_path() -> PathBuf {
    std::env::var_os("BANCADA_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_default();
            PathBuf::from(home).join(".config/bancada/config.json")
        })
}

fn load_config() -> Result<Config, String> {
    let path = config_path();
    // A missing configuration is not a failure: it is a cockpit nobody has
    // pointed at anything yet, and the empty screen says so.
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Ok(Config::default());
    };
    Config::parse(&text).map_err(|e| format!("{}: {e:?}", path.display()))
}

fn millis_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// The clock and the filesystem are read here, at the edge, and passed inward.
// `SystemTime` and `std::fs` are denied across the workspace so that nothing
// *below* reaches for them — this is the boundary the rule exists to create,
// not a place it was meant to apply.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Config, Glance};
use bancada_rules::{Grouped, Wip};
use bancada_runtime::{HostRuntime, Runtime};
use serde::Serialize;
use std::path::PathBuf;

/// What the webview receives.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Queue {
    groups: Vec<Grouped>,
    wip: Wip,
    /// How many projects are being read. An empty queue with three
    /// projects watched and an empty queue with none configured are
    /// different states, and they look identical without this.
    watching: usize,
    /// How many of those may ask for you, and how many are silenced.
    ///
    /// Both, rather than one and a subtraction. "6 active" beside a queue
    /// with nothing in it says the product is watching and there is nothing
    /// to do; "6 active · 2 silenced" also says why the other two are not
    /// there, which is the question somebody asks about the project they
    /// silenced last week and forgot.
    asking: usize,
    silenced: usize,
    /// Named rather than silent: a project the product could not read
    /// looks exactly like a project with nothing pending.
    unreachable: Vec<String>,
    /// What each session is *about*, by session id.
    ///
    /// Read after the ranking is settled and merged in here, at the edge.
    /// The order comes from metadata alone — that is hard rule 2 and the
    /// reason hallucination can never reach it — but a row that says
    /// `Review` beside a uuid has to be opened before you know whether it
    /// matters, and triage you cannot do without opening is not triage.
    /// Nothing in `bancada-rules` sees a word of this.
    glances: std::collections::BTreeMap<String, Glance>,
    /// Set only when the configuration came from somewhere other than the
    /// default path.
    ///
    /// A cockpit pointed at a scratch configuration looks exactly like the
    /// real one, and the whole product is a claim about what needs you —
    /// so it has to say when the claim is about somewhere else.
    elsewhere: Option<String>,
}

impl Queue {
    // Read by the integration test, which drives these commands the way the
    // webview does. Serialising and re-parsing to assert on three numbers
    // would be a test of `serde`.
    pub fn asking(&self) -> usize {
        self.asking
    }
    pub fn silenced(&self) -> usize {
        self.silenced
    }
    pub fn watching(&self) -> usize {
        self.watching
    }
    pub fn groups(&self) -> &[Grouped] {
        &self.groups
    }
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
    let mut glances = std::collections::BTreeMap::new();

    let mut silenced = 0;

    for project in &cockpit.config().projects {
        let limits = cockpit.config().limits_of(project);
        let scan = cockpit.scan(project, &host);
        if let Some(why) = scan.unreachable {
            unreachable.push(format!("{}: {why}", project.id));
            continue;
        }
        // Read either way, and dropped here rather than skipped above: a
        // silenced project still has to be counted, and the count of its
        // sessions is what decides whether it is silenced at all.
        if !project.asking(scan.logs.len()) {
            silenced += 1;
            continue;
        }
        // Folded first, and only then asked. Whether a session still needs
        // you depends on the sessions beside it — a newer one quiets what
        // had already stopped — so a log at a time cannot answer it. States
        // rather than facts: a log is tens of megabytes and a state is three
        // timestamps and a name, so this holds a project, not its logs.
        let mut states = Vec::new();
        let mut where_from = std::collections::BTreeMap::new();
        for log in scan.logs {
            match host.read_file(&log) {
                Ok(bytes) => {
                    let facts = Cockpit::facts(&String::from_utf8_lossy(&bytes));
                    for s in Cockpit::states_of(&facts) {
                        where_from.insert(s.session.as_str().to_owned(), log.clone());
                        states.push(s);
                    }
                }
                Err(e) => unreachable.push(format!("{}: {e:?}", log.display())),
            }
        }

        let raised = Cockpit::queue_of(project, &limits, &states, now);
        // Read a second time, and only for the sessions that reached the
        // queue. A project with forty finished logs should not cost forty
        // content reads every ten seconds to say nothing — and which forty
        // are worth reading is not known until the queue is settled.
        for session in raised.iter().map(|i| i.session.as_str()) {
            if glances.contains_key(session) {
                continue;
            }
            if let Some(log) = where_from.get(session)
                && let Ok(bytes) = host.read_file(log)
            {
                glances.insert(
                    session.to_owned(),
                    Glance::of(&String::from_utf8_lossy(&bytes)),
                );
            }
        }
        items.extend(raised);
    }

    let watching = cockpit.config().projects.len();
    let (groups, wip) = Cockpit::present(items, now);
    Ok(Queue {
        groups,
        wip,
        watching,
        asking: watching - silenced,
        silenced,
        unreachable,
        glances,
        elsewhere: overridden_config(),
    })
}

/// The configuration path, when it is not the default one.
///
/// `None` for the real cockpit, so the band costs nothing to the case that
/// matters — a warning that is always on is a warning nobody reads.
fn overridden_config() -> Option<String> {
    std::env::var_os("BANCADA_CONFIG").map(|p| PathBuf::from(p).display().to_string())
}

pub(crate) fn config_path() -> PathBuf {
    std::env::var_os("BANCADA_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_default();
            PathBuf::from(home).join(".config/bancada/config.json")
        })
}

/// This machine's home directory.
///
/// The one ambient fact the configuration needs, read here beside the clock
/// for the same reason: nothing below the edge asks the environment, so the
/// core stays a pure function of what it was handed.
pub(super) fn home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
}

pub(crate) fn load_config() -> Result<Config, String> {
    let path = config_path();
    // A missing configuration is not a failure: it is a cockpit nobody has
    // pointed at anything yet, and the empty screen says so. It still knows
    // the machine it is running on — that much needs no telling.
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Ok(Config::default().with_this_machine(&home()));
    };
    Config::parse_with_home(&text, &home()).map_err(|e| format!("{}: {e:?}", path.display()))
}

pub(crate) fn millis_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

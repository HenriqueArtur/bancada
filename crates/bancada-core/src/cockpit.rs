use crate::{Config, Project};
use bancada_adapter_claude::SessionLog;
use bancada_meta::{MetaEvent, Timestamp};
use bancada_rules::{Grouped, QueueItem, SessionState, Wip, group, rank};
use bancada_runtime::{Runtime, RuntimeError};
use std::path::{Path, PathBuf};

/// The whole pipeline, in one place: logs to queue.
///
/// Everything below is deterministic and takes `now` as an argument.
/// Nothing here reads a clock, so the same inputs produce the same queue —
/// which is what makes the ranking testable at all.
pub struct Cockpit {
    config: Config,
}

/// One project's log directory, listed and read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Scan {
    pub project: String,
    pub logs: Vec<PathBuf>,
    /// Named rather than silent: a project the product cannot read looks
    /// exactly like a project with nothing happening.
    pub unreachable: Option<String>,
}

impl Cockpit {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Where one project's logs live, on the machine that can read them.
    ///
    /// The directory name is **computed** from the registered path. It is
    /// never read back off disk and reversed — the encoding is lossy.
    pub fn log_dir(&self, project: &Project) -> Option<PathBuf> {
        let spec = self.config.runtime_of(project)?;
        Some(
            Path::new(&spec.config_dir)
                .join("projects")
                .join(project.log_dir_name()),
        )
    }

    /// List the logs of one project, through a runtime that can reach them.
    pub fn scan(&self, project: &Project, host: &dyn Runtime) -> Scan {
        let Some(dir) = self.log_dir(project) else {
            return Scan {
                project: project.id.clone(),
                logs: Vec::new(),
                unreachable: Some("no runtime registered".into()),
            };
        };
        match host.read_dir(&dir) {
            Ok(entries) => Scan {
                project: project.id.clone(),
                logs: entries
                    .into_iter()
                    .filter(|p| p.extension().is_some_and(|e| e == "jsonl"))
                    .collect(),
                unreachable: None,
            },
            Err(RuntimeError::NotFound(_)) => Scan {
                project: project.id.clone(),
                logs: Vec::new(),
                // Not an error: a project with no sessions yet has no
                // directory. Silence here is the honest answer.
                unreachable: None,
            },
            Err(e) => Scan {
                project: project.id.clone(),
                logs: Vec::new(),
                unreachable: Some(format!("{e:?}")),
            },
        }
    }

    /// Turn one log's text into the facts the engine may see.
    pub fn facts(log: &str) -> Vec<MetaEvent> {
        SessionLog::parse(log)
            .events
            .iter()
            .filter_map(|e| e.to_meta())
            .collect()
    }

    /// The queue for one project, from its facts.
    pub fn queue_of(project: &Project, facts: &[MetaEvent], now: Timestamp) -> Vec<QueueItem> {
        SessionState::queue(&SessionState::fold(facts), now, project.idle_after_ms())
            .into_iter()
            .map(|i| i.with_weight(project.weight))
            .collect()
    }

    /// Rank and group a whole queue.
    pub fn present(items: Vec<QueueItem>, now: Timestamp) -> (Vec<Grouped>, Wip) {
        let groups = group(rank(&items, now));
        let wip = Wip::of(&groups, Wip::DEFAULT_LIMIT);
        (groups, wip)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bancada_meta::DecisionKind;

    const CFG: &str = r#"{
      "workspaces": [{"id":"personal"}],
      "runtimes": [{"id":"local","kind":"local","configDir":"/state/claude","sharedFs":true}],
      "projects": [{"id":"p","workspace":"personal","runtime":"local",
                    "path":"/mnt/dev/neo-gitmoji.nvim","weight":3}]
    }"#;

    fn cockpit() -> Cockpit {
        Cockpit::new(Config::parse(CFG).unwrap())
    }

    #[test]
    fn a_log_directory_is_built_from_the_registered_path() {
        let c = cockpit();
        let dir = c.log_dir(&c.config().projects[0]).unwrap();
        assert_eq!(
            dir,
            PathBuf::from("/state/claude/projects/-mnt-dev-neo-gitmoji-nvim")
        );
    }

    #[test]
    fn a_project_with_no_log_directory_yet_is_quiet_rather_than_broken() {
        let c = cockpit();
        let s = c.scan(
            &c.config().projects[0],
            &bancada_runtime::HostRuntime::local(),
        );
        assert!(s.logs.is_empty());
        assert_eq!(
            s.unreachable, None,
            "a project that never ran is not a failure"
        );
    }

    #[test]
    fn a_projects_weight_reaches_the_items_it_produces() {
        let c = cockpit();
        let p = &c.config().projects[0];
        let now = Timestamp::from_millis(1_000_000);
        let facts = vec![
            MetaEvent::HumanSpoke {
                session: bancada_meta::SessionId::new("s"),
                at: Timestamp::from_millis(1),
            },
            MetaEvent::DecisionRaised {
                session: bancada_meta::SessionId::new("s"),
                at: Timestamp::from_millis(2),
                id: "t1".into(),
                kind: DecisionKind::Question,
            },
        ];
        let q = Cockpit::queue_of(p, &facts, now);
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].project_weight, 3);
    }

    #[test]
    fn an_empty_queue_presents_as_nothing_and_is_not_over_the_limit() {
        let (groups, wip) = Cockpit::present(vec![], Timestamp::from_millis(1));
        assert!(groups.is_empty());
        assert!(!wip.over());
    }
}

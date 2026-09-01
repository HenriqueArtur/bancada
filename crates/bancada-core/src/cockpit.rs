use crate::{Config, Diff, Project};
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
            .map(|i| i.with_weight(project.weight).in_project(&project.id))
            .collect()
    }

    /// Rank and group a whole queue.
    pub fn present(items: Vec<QueueItem>, now: Timestamp) -> (Vec<Grouped>, Wip) {
        let groups = group(rank(&items, now));
        let wip = Wip::of(&groups, Wip::DEFAULT_LIMIT);
        (groups, wip)
    }

    /// Everything this project's tree says has changed against `HEAD`,
    /// including files git has never been told about.
    ///
    /// Untracked files are rendered as an all-addition diff rather than
    /// listed by name, so they carry a fingerprint like every other file and
    /// take part in "what moved since I last looked". A brand new file is
    /// usually the one worth reading first, and a name alone cannot be
    /// reviewed.
    ///
    /// Nothing here writes: no `add -N`, no index touch. The product reads a
    /// repository the human is working in, and a supervisor that stages files
    /// behind their back is worse than one that shows less.
    pub fn diff_of(&self, project: &Project, host: &dyn Runtime) -> Result<Diff, String> {
        let at = project.path.as_str();
        let git = |args: &[&str]| -> Result<String, String> {
            let mut cmd = vec!["git".to_owned(), "-C".to_owned(), at.to_owned()];
            cmd.extend(args.iter().map(|a| (*a).to_owned()));
            host.exec(&cmd).map_err(|e| format!("{e:?}"))
        };

        let tracked = git(&["diff", "HEAD", "--no-color", "--no-ext-diff"])?;
        let mut text = tracked;
        for name in git(&["ls-files", "--others", "--exclude-standard"])?.lines() {
            if let Some(rendered) = Self::as_added_file(host, at, name) {
                text.push_str(&rendered);
            }
        }
        Ok(Diff::parse(&text))
    }

    /// One untracked file, spelled as a diff that adds every line.
    ///
    /// Returns `None` for anything unreadable or not text: a binary blob
    /// rendered as lines is noise, and noise in a review list is what makes
    /// people stop reading the list.
    fn as_added_file(host: &dyn Runtime, at: &str, name: &str) -> Option<String> {
        const MAX: usize = 256 * 1024;
        let bytes = host.read_file(&Path::new(at).join(name)).ok()?;
        if bytes.len() > MAX || bytes.contains(&0) {
            return None;
        }
        let body = String::from_utf8(bytes).ok()?;
        let count = body.lines().count();
        let mut out = format!("diff --git a/{name} b/{name}\n@@ -0,0 +1,{count} @@\n");
        for line in body.lines() {
            out.push('+');
            out.push_str(line);
            out.push('\n');
        }
        Some(out)
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

    /// A runtime that answers git with canned output and serves one untracked
    /// file, so the diff path can be exercised without a repository.
    struct FakeGit {
        tracked: String,
        untracked: Vec<(String, Vec<u8>)>,
    }

    impl Runtime for FakeGit {
        fn id(&self) -> &str {
            "fake"
        }
        fn kind(&self) -> &str {
            "local"
        }
        fn paths(&self) -> &bancada_runtime::PathMap {
            unimplemented!("the diff path never maps a path")
        }
        fn fs_access(&self) -> bancada_runtime::FsAccess {
            bancada_runtime::FsAccess::Shared
        }
        fn exec(&self, cmd: &[String]) -> Result<String, RuntimeError> {
            match cmd.get(3).map(String::as_str) {
                Some("diff") => Ok(self.tracked.clone()),
                Some("ls-files") => Ok(self
                    .untracked
                    .iter()
                    .map(|(n, _)| n.as_str())
                    .collect::<Vec<_>>()
                    .join("\n")),
                other => Err(RuntimeError::Failed(format!("unexpected: {other:?}"))),
            }
        }
        fn read_file(&self, p: &Path) -> Result<Vec<u8>, RuntimeError> {
            self.untracked
                .iter()
                .find(|(n, _)| p.ends_with(n))
                .map(|(_, b)| b.clone())
                .ok_or_else(|| RuntimeError::NotFound(p.display().to_string()))
        }
        fn read_dir(&self, p: &Path) -> Result<Vec<PathBuf>, RuntimeError> {
            Err(RuntimeError::NotFound(p.display().to_string()))
        }
    }

    const TRACKED: &str = "diff --git a/src/db.rs b/src/db.rs\n@@ -1,2 +1,2 @@\n fn open() {\n-    old();\n+    new();\n";

    fn fake_git(untracked: Vec<(&str, &str)>) -> FakeGit {
        FakeGit {
            tracked: TRACKED.to_owned(),
            untracked: untracked
                .into_iter()
                .map(|(n, b)| (n.to_owned(), b.as_bytes().to_vec()))
                .collect(),
        }
    }

    #[test]
    fn a_tracked_change_reaches_the_diff() {
        let c = cockpit();
        let d = c
            .diff_of(&c.config().projects[0], &fake_git(vec![]))
            .unwrap();
        assert_eq!(d.files.len(), 1);
        assert_eq!((d.added(), d.removed()), (1, 1));
    }

    #[test]
    fn an_untracked_file_is_shown_as_content_not_as_a_name() {
        let c = cockpit();
        let rt = fake_git(vec![("notes.md", "one\ntwo\n")]);
        let d = c.diff_of(&c.config().projects[0], &rt).unwrap();

        let new = d.files.iter().find(|f| f.path == "notes.md").unwrap();
        assert_eq!(new.added, 2, "a name alone cannot be reviewed");
        assert!(!new.fingerprint.is_empty());
    }

    #[test]
    fn a_binary_untracked_file_is_left_out_rather_than_rendered_as_lines() {
        let c = cockpit();
        let rt = fake_git(vec![("logo.png", "\u{0}\u{1}\u{2}binary")]);
        let d = c.diff_of(&c.config().projects[0], &rt).unwrap();
        assert!(d.files.iter().all(|f| f.path != "logo.png"));
    }

    #[test]
    fn the_diff_never_asks_git_to_write() {
        // `add -N` would make untracked files appear in `git diff` for free,
        // and would also stage them in the human's repository.
        let src = include_str!("cockpit.rs");
        assert!(!src.contains("\"add\""), "the diff path stages files");
    }
}

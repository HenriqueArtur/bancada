use crate::{Config, Diff, Project, Summary};
use bancada_adapter_claude::SessionLog;
use bancada_meta::{MetaEvent, SessionId, Timestamp};
use bancada_rules::{Grouped, QueueItem, SessionState, Wip, group, rank};
use bancada_runtime::{Runtime, RuntimeError};
use std::collections::BTreeSet;
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

    /// Every directory worth watching for a change.
    ///
    /// One per runtime that some project uses, not one per project: the
    /// projects of a runtime all live under the same `projects` folder, and
    /// a watch each would be a dozen watches on one directory.
    ///
    /// These are *host* paths, always. `configDir` is written in this
    /// machine's spelling by definition — it is how the logs are read at all
    /// — so a watch never has to cross into a guest, whatever kind of place
    /// the project itself runs in. The architecture anticipated a harder
    /// problem here than the one that exists.
    pub fn watched(&self, config_path: &Path) -> Vec<PathBuf> {
        let mut out: BTreeSet<PathBuf> = BTreeSet::new();
        for project in &self.config.projects {
            if let Some(spec) = self.config.runtime_of(project) {
                out.insert(Path::new(&spec.config_dir).join("projects"));
            }
        }
        // The configuration too, so registering a project or a machine
        // reaches the screens without a restart. Its *directory*: an editor
        // saves by writing a new file and renaming it over the old one, and
        // a watch on the path itself follows the file that was replaced.
        if let Some(parent) = config_path.parent() {
            out.insert(parent.to_path_buf());
        }
        out.into_iter().collect()
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

    /// One log's facts, folded into what its sessions look like now.
    ///
    /// Separate from [`Cockpit::queue_of`] because a project's logs are read
    /// one at a time and the queue is decided across all of them: a newer
    /// session quiets the ones that had already stopped, which is a question
    /// about the sessions beside each other. Folding first keeps the answer
    /// possible without holding every log's facts at once — a log is tens of
    /// megabytes, and a state is three timestamps and a name.
    pub fn states_of(facts: &[MetaEvent]) -> Vec<SessionState> {
        SessionState::fold(facts)
    }

    /// The queue for one project, from every session it has.
    pub fn queue_of(project: &Project, states: &[SessionState], now: Timestamp) -> Vec<QueueItem> {
        let kept: Vec<SessionId> = project.kept.iter().map(SessionId::new).collect();
        SessionState::queue(states, now, project.idle_after_ms(), &kept)
            .into_iter()
            .map(|i| i.with_weight(project.weight).in_project(&project.id))
            .collect()
    }

    /// The sessions of this project a newer one is holding back.
    ///
    /// Beside [`Cockpit::queue_of`] rather than inside it: the queue is what
    /// needs you, and this is the reason something is missing from it. A
    /// screen showing sessions needs both, and the queue needs only the one.
    pub fn quieted_in(
        project: &Project,
        states: &[SessionState],
        now: Timestamp,
    ) -> Vec<SessionId> {
        let kept: Vec<SessionId> = project.kept.iter().map(SessionId::new).collect();
        SessionState::quieted(states, now, project.idle_after_ms(), &kept)
    }

    /// Which session of a project you have moved to.
    ///
    /// No project and no clock: it is the last session opened, which is a
    /// fact about the sessions alone. Beside `quieted_in` because the two
    /// are the same rule from opposite sides, and a screen showing one
    /// without the other says only which rows went quiet.
    pub fn current_in(states: &[SessionState]) -> Option<SessionId> {
        SessionState::current(states).map(|s| s.session.clone())
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

    /// Whether git has ever been told about this tree.
    ///
    /// Asked before the diff rather than read out of its failure. Run in a
    /// plain directory, `git diff HEAD` exits 129 with a *usage message* —
    /// so a screen that reported the error reported a crash for one of the
    /// most ordinary states a project can be in. Pattern-matching that text
    /// would be reading one version of git's help output.
    pub fn versioned(&self, project: &Project, host: &dyn Runtime) -> bool {
        host.exec(&[
            "git".to_owned(),
            "-C".to_owned(),
            project.path.clone(),
            "rev-parse".to_owned(),
            "--git-dir".to_owned(),
        ])
        .is_ok()
    }

    /// How much has moved, without the diff itself.
    ///
    /// `--numstat` rather than `diff_of(..).summary()`: the footer is on all
    /// four screens, and three numbers are not worth parsing thirty thousand
    /// lines of hunks on the tree screen to reach. The untracked files still
    /// cost a read each, exactly as they do for the diff.
    pub fn summary_of(&self, project: &Project, host: &dyn Runtime) -> Result<Summary, String> {
        if !self.versioned(project, host) {
            // Three zeroes would be a claim about a repository there is none
            // of. The footer says which it is.
            return Ok(Summary::default());
        }
        let at = project.path.as_str();
        let git = |args: &[&str]| -> Result<String, String> {
            let mut cmd = vec!["git".to_owned(), "-C".to_owned(), at.to_owned()];
            cmd.extend(args.iter().map(|a| (*a).to_owned()));
            host.exec(&cmd).map_err(|e| format!("{e:?}"))
        };

        let mut out = Summary {
            versioned: true,
            ..Summary::default()
        };
        for line in git(&["diff", "HEAD", "--numstat", "--no-color", "--no-ext-diff"])?.lines() {
            let mut cols = line.split('\t');
            let (Some(added), Some(removed)) = (cols.next(), cols.next()) else {
                continue;
            };
            out.files += 1;
            // `-\t-\t` is git saying binary. It counts as a changed file
            // and as no lines, which is the truth about it.
            out.added += added.parse::<usize>().unwrap_or(0);
            out.removed += removed.parse::<usize>().unwrap_or(0);
        }
        for name in git(&["ls-files", "--others", "--exclude-standard"])?.lines() {
            if let Some(rendered) = Self::as_added_file(host, at, name) {
                out.files += 1;
                // Every line of it is an added line, which is what the diff
                // screen already says about an untracked file.
                out.added += rendered.lines().filter(|l| l.starts_with('+')).count();
            }
        }
        Ok(out)
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
        // `new file mode` is not decoration: it is what makes the parser
        // call this added rather than modified, on the same path every
        // other file takes. Without it, untracked files would need a second
        // rule somewhere else that says so.
        let mut out =
            format!("diff --git a/{name} b/{name}\nnew file mode 100644\n@@ -0,0 +1,{count} @@\n");
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
    use bancada_testing::{Answers, FakeRuntime};

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
    fn one_directory_is_watched_per_runtime_and_not_per_project() {
        // The projects of a runtime share one `projects` folder. A watch
        // each would be several watches on one directory, and several
        // notifications for one line.
        let c = Cockpit::new(
            Config::parse(
                r#"{
      "workspaces": [{"id":"w"}],
      "runtimes": [{"id":"r","kind":"local","configDir":"/state/claude","sharedFs":true}],
      "projects": [{"id":"a","workspace":"w","runtime":"r","path":"/x","weight":1},
                   {"id":"b","workspace":"w","runtime":"r","path":"/y","weight":1}]
    }"#,
            )
            .unwrap(),
        );
        assert_eq!(
            c.watched(Path::new("/cfg/bancada/config.json")),
            vec![
                PathBuf::from("/cfg/bancada"),
                PathBuf::from("/state/claude/projects")
            ]
        );
    }

    #[test]
    fn a_project_whose_runtime_is_gone_is_not_watched() {
        // Built by hand, because `Config::parse` refuses a dangling runtime
        // and this guard is for a configuration that did not come through
        // it — a half-applied edit, or a future caller assembling one.
        let mut config = Config::default();
        config.projects.push(
            serde_json::from_str(
                r#"{"id":"a","workspace":"w","runtime":"nowhere","path":"/x","weight":1}"#,
            )
            .unwrap(),
        );
        assert_eq!(
            Cockpit::new(config).watched(Path::new("/cfg/config.json")),
            vec![PathBuf::from("/cfg")]
        );
    }

    #[test]
    fn the_configuration_is_watched_even_with_nothing_registered() {
        // It is how the first project ever registered reaches the screens
        // without a restart.
        assert_eq!(
            Cockpit::new(Config::default()).watched(Path::new("/cfg/config.json")),
            vec![PathBuf::from("/cfg")]
        );
    }

    #[test]
    fn a_configuration_at_the_root_watches_nothing_extra() {
        assert!(
            Cockpit::new(Config::default())
                .watched(Path::new("/"))
                .is_empty()
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
    fn the_project_says_which_session_you_moved_to() {
        // The other side of the silence. Held back and moved to are one
        // rule read from either end, and a screen given only the first can
        // say which rows went quiet but not which row did it.
        let spoke = |who: &str, at: i64| MetaEvent::AgentSpoke {
            session: bancada_meta::SessionId::new(who),
            at: Timestamp::from_millis(at),
        };
        let states = Cockpit::states_of(&[spoke("old", 100), spoke("new", 200)]);

        assert_eq!(
            Cockpit::current_in(&states).as_ref().map(SessionId::as_str),
            Some("new")
        );
    }

    #[test]
    fn the_project_says_which_of_its_sessions_a_newer_one_is_holding_back() {
        // The names the screen needs to explain a silence, and the same
        // `kept` list that decides the queue — read here rather than spelled
        // twice, because two spellings drift and this is the one question
        // both screens are about.
        let c = cockpit();
        let now = Timestamp::from_millis(1_000_000);
        let spoke = |who: &str, at: i64| MetaEvent::AgentSpoke {
            session: bancada_meta::SessionId::new(who),
            at: Timestamp::from_millis(at),
        };
        let states = Cockpit::states_of(&[spoke("old", 100), spoke("new", 200)]);

        let held = Cockpit::quieted_in(&c.config().projects[0], &states, now);
        assert_eq!(
            held.iter().map(SessionId::as_str).collect::<Vec<_>>(),
            ["old"]
        );

        let kept = Project {
            kept: vec!["old".to_owned()],
            ..c.config().projects[0].clone()
        };
        assert!(Cockpit::quieted_in(&kept, &states, now).is_empty());
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
        let q = Cockpit::queue_of(p, &Cockpit::states_of(&facts), now);
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].project_weight, 3);
    }

    #[test]
    fn an_empty_queue_presents_as_nothing_and_is_not_over_the_limit() {
        let (groups, wip) = Cockpit::present(vec![], Timestamp::from_millis(1));
        assert!(groups.is_empty());
        assert!(!wip.over());
    }

    /// The git answers `diff_of` asks for, and nothing else.
    ///
    /// `Answers` refuses an unscripted command, so a test that reaches
    /// further than it meant to says so instead of quietly getting "".
    fn git(tracked: &str, untracked: &[(&str, &str)]) -> FakeRuntime {
        let names = untracked
            .iter()
            .map(|(n, _)| *n)
            .collect::<Vec<_>>()
            .join("\n");
        FakeRuntime::new(Answers {
            says: vec![
                (
                    "git -C /mnt/dev/neo-gitmoji.nvim diff".into(),
                    tracked.into(),
                ),
                ("ls-files".into(), names),
            ],
            files: untracked
                .iter()
                .map(|(n, body)| {
                    (
                        format!("/mnt/dev/neo-gitmoji.nvim/{n}"),
                        body.as_bytes().to_vec(),
                    )
                })
                .collect(),
            ..Answers::default()
        })
    }

    const TRACKED: &str = "diff --git a/src/db.rs b/src/db.rs\n@@ -1,2 +1,2 @@\n fn open() {\n-    old();\n+    new();\n";

    #[test]
    fn a_tracked_change_reaches_the_diff() {
        let c = cockpit();
        let d = c
            .diff_of(&c.config().projects[0], &git(TRACKED, &[]))
            .unwrap();
        assert_eq!(d.files.len(), 1);
        assert_eq!((d.added(), d.removed()), (1, 1));
    }

    #[test]
    fn an_untracked_file_is_shown_as_content_not_as_a_name() {
        let c = cockpit();
        let rt = git(TRACKED, &[("notes.md", "one\ntwo\n")]);
        let d = c.diff_of(&c.config().projects[0], &rt).unwrap();

        let new = d.files.iter().find(|f| f.path == "notes.md").unwrap();
        assert_eq!(new.added, 2, "a name alone cannot be reviewed");
        assert!(!new.fingerprint.is_empty());
    }

    #[test]
    fn a_binary_untracked_file_is_left_out_rather_than_rendered_as_lines() {
        let c = cockpit();
        let rt = git(TRACKED, &[("logo.png", "\u{0}\u{1}\u{2}binary")]);
        let d = c.diff_of(&c.config().projects[0], &rt).unwrap();
        assert!(d.files.iter().all(|f| f.path != "logo.png"));
    }

    /// The same tree, answered with `--numstat` instead of a diff.
    fn counted(numstat: &str, untracked: &[(&str, &str)]) -> FakeRuntime {
        let names = untracked
            .iter()
            .map(|(n, _)| *n)
            .collect::<Vec<_>>()
            .join("\n");
        FakeRuntime::new(Answers {
            says: vec![
                // Asked before anything else: a plain directory answers the
                // diff with a usage message, not with an empty diff.
                ("rev-parse".into(), ".git".into()),
                ("numstat".into(), numstat.into()),
                ("ls-files".into(), names),
            ],
            files: untracked
                .iter()
                .map(|(n, body)| {
                    (
                        format!("/mnt/dev/neo-gitmoji.nvim/{n}"),
                        body.as_bytes().to_vec(),
                    )
                })
                .collect(),
            ..Answers::default()
        })
    }

    #[test]
    fn a_directory_git_has_never_heard_of_is_not_versioned() {
        // `Answers` refuses an unscripted command, so a runtime told nothing
        // about `rev-parse` is exactly a machine where it fails.
        let c = cockpit();
        let bare = FakeRuntime::new(Answers::default());
        assert!(!c.versioned(&c.config().projects[0], &bare));
    }

    #[test]
    fn a_project_that_is_not_a_repository_summarises_as_nothing_of_the_kind() {
        // Three zeroes would be a claim about a repository there is none of,
        // and "nothing uncommitted" is the wrong thing for a screen to say
        // about a folder somebody is working in.
        let c = cockpit();
        let bare = FakeRuntime::new(Answers::default());
        let s = c.summary_of(&c.config().projects[0], &bare).unwrap();
        assert!(!s.versioned);
        assert_eq!((s.files, s.added, s.removed), (0, 0, 0));
    }

    #[test]
    fn the_summary_counts_both_directions_without_parsing_a_diff() {
        // Three numbers, and the footer that shows them sits on all four
        // screens — the tree screen has no reason to pay for the hunks.
        let c = cockpit();
        let rt = counted("12\t3\tsrc/db.rs\n4\t0\tsrc/x.rs\n", &[]);
        let s = c.summary_of(&c.config().projects[0], &rt).unwrap();
        assert_eq!((s.files, s.added, s.removed), (2, 16, 3));
        assert!(s.versioned);
    }

    #[test]
    fn a_binary_file_counts_as_changed_and_as_no_lines() {
        // `-\t-\t` is git saying it cannot count them, which is the truth
        // about the file and not a reason to leave it out of the count.
        let c = cockpit();
        let rt = counted("-\t-\tlogo.png\n", &[]);
        let s = c.summary_of(&c.config().projects[0], &rt).unwrap();
        assert_eq!((s.files, s.added, s.removed), (1, 0, 0));
    }

    #[test]
    fn an_untracked_file_counts_as_every_line_it_has() {
        // Which is what the diff screen already says about one.
        let c = cockpit();
        let rt = counted("", &[("notes.md", "one\ntwo\nthree\n")]);
        let s = c.summary_of(&c.config().projects[0], &rt).unwrap();
        assert_eq!((s.files, s.added, s.removed), (1, 3, 0));
    }

    #[test]
    fn a_binary_untracked_file_is_not_counted_at_all() {
        // Unreadable as lines. Counted, the footer would claim a number the
        // diff screen refuses to show.
        let c = cockpit();
        let rt = counted("", &[("logo.png", "\u{0}\u{1}binary")]);
        let s = c.summary_of(&c.config().projects[0], &rt).unwrap();
        assert_eq!(s.files, 0);
    }

    #[test]
    fn a_clean_tree_summarises_as_nothing_rather_than_as_an_error() {
        let c = cockpit();
        let s = c
            .summary_of(&c.config().projects[0], &counted("", &[]))
            .unwrap();
        assert_eq!(
            s,
            crate::Summary {
                versioned: true,
                ..crate::Summary::default()
            },
            "a clean repository is not the same fact as no repository"
        );
    }

    #[test]
    fn a_numstat_line_git_did_not_finish_writing_is_skipped() {
        // Defensive rather than observed: a half line counted as a file
        // would make the footer disagree with the screen beside it.
        let c = cockpit();
        let rt = counted("12\n4\t0\tsrc/x.rs\n", &[]);
        let s = c.summary_of(&c.config().projects[0], &rt).unwrap();
        assert_eq!((s.files, s.added), (1, 4));
    }

    #[test]
    fn the_diff_never_asks_git_to_write() {
        // `add -N` would make untracked files appear in `git diff` for free,
        // and would also stage them in the human's repository.
        let src = include_str!("cockpit.rs");
        assert!(!src.contains("\"add\""), "the diff path stages files");
    }
    #[test]
    fn a_project_naming_no_runtime_is_named_rather_than_skipped() {
        // `Config::parse` refuses a dangling reference, so this can only be
        // reached by building one — which is exactly what a future writer of
        // configuration in code would do.
        let broken = Config {
            workspaces: vec![],
            runtimes: vec![],
            projects: vec![Project {
                id: "orphan".into(),
                workspace: "w".into(),
                runtime: "gone".into(),
                path: "/x".into(),
                weight: 1,
                idle_after_minutes: 2,
                muted: None,
                kept: Vec::new(),
            }],
        };
        let c = Cockpit::new(broken);
        let scan = c.scan(&c.config().projects[0], &FakeRuntime::empty());
        assert_eq!(scan.unreachable.as_deref(), Some("no runtime registered"));
        assert!(scan.logs.is_empty());
    }

    #[test]
    fn a_machine_that_refused_is_not_a_project_with_nothing_pending() {
        // The distinction this product keeps getting wrong: absent and
        // refused are two answers, and only one of them is quiet.
        let c = cockpit();
        let asleep = FakeRuntime::new(Answers {
            refuse: vec!["projects".into()],
            ..Answers::default()
        });
        let scan = c.scan(&c.config().projects[0], &asleep);
        assert!(scan.unreachable.is_some(), "a refusal read as silence");
    }
}

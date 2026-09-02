//! The commands, driven end to end against a tree on disk.
//!
//! One test, walking them in order, rather than a dozen. The seam reads its
//! configuration from `BANCADA_CONFIG`, which is process-global — a dozen
//! tests would race over it, and a suite whose failures depend on scheduling
//! is a suite people rerun instead of read.
//!
//! It is also the only place the product is exercised the way it actually
//! runs: a real directory, a real harness log, and the same commands the
//! webview calls.
// The bench builds a real tree, which is the whole point of it: the seam is
// the layer that touches a filesystem, and a test that faked one would be
// testing the fake. Denied everywhere else, allowed here for the same reason
// it is allowed in the commands.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use std::fs;
use std::path::{Path, PathBuf};

/// A throwaway tree: a configuration, a harness state directory, and a
/// project that is a git repository with something uncommitted in it.
struct Bench {
    root: PathBuf,
}

impl Bench {
    fn raise() -> Self {
        let root = std::env::temp_dir().join(format!("bancada-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);

        let project = root.join("project");
        let logs = root.join("home/.claude/projects");
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&logs).unwrap();

        fs::write(project.join("kept.rs"), "fn main() {}\n").unwrap();
        run(&project, &["git", "init", "-q"]);
        run(&project, &["git", "add", "."]);
        run(
            &project,
            &[
                "git",
                "-c",
                "user.email=t@t",
                "-c",
                "user.name=T",
                "commit",
                "-qm",
                "first",
            ],
        );
        // One tracked change and one file git has never heard of.
        fs::write(
            project.join("kept.rs"),
            "fn main() {\n    println!(\"hi\");\n}\n",
        )
        .unwrap();
        fs::write(project.join("new.md"), "notes\n").unwrap();

        let encoded: String = project
            .display()
            .to_string()
            .chars()
            .map(|c| if c == '/' || c == '.' { '-' } else { c })
            .collect();
        fs::create_dir_all(logs.join(&encoded)).unwrap();
        fs::write(logs.join(&encoded).join("s1.jsonl"), session()).unwrap();

        let config = root.join("config.json");
        fs::write(
            &config,
            format!(
                r#"{{"workspaces":[{{"id":"personal"}}],
                    "runtimes":[{{"id":"here","kind":"local","configDir":"{}","sharedFs":true}}],
                    "projects":[{{"id":"thing","workspace":"personal","runtime":"here","path":"{}","idleAfterMinutes":0}}]}}"#,
                root.join("home/.claude").display(),
                project.display()
            ),
        )
        .unwrap();

        // SAFETY: one test in one process, set before anything reads it.
        unsafe { std::env::set_var("BANCADA_CONFIG", &config) };
        Self { root }
    }

    fn project(&self) -> PathBuf {
        self.root.join("project")
    }

    /// Where the harness keeps this project's logs, spelled the way the
    /// harness spells it. Recomputed rather than kept, so a change to the
    /// encoding breaks the test that depends on it.
    fn log_dir(&self) -> PathBuf {
        let encoded: String = self
            .project()
            .display()
            .to_string()
            .chars()
            .map(|c| if c == '/' || c == '.' { '-' } else { c })
            .collect();
        self.root.join("home/.claude/projects").join(encoded)
    }
}

impl Drop for Bench {
    fn drop(&mut self) {
        // A test that leaves a tree behind is a test that fills a disk. The
        // suite is also checked by `git diff` afterwards, but this one lives
        // in the system's temp directory where nothing would notice.
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn run(at: &Path, cmd: &[&str]) {
    let out = std::process::Command::new(cmd[0])
        .args(&cmd[1..])
        .current_dir(at)
        .output()
        .unwrap_or_else(|e| panic!("{cmd:?}: {e}"));
    assert!(
        out.status.success(),
        "{cmd:?} failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

/// A session that said what it would do, did more, and is waiting.
fn session() -> String {
    [
        r#"{"type":"user","sessionId":"s1","timestamp":"2020-01-01T00:00:00Z","message":{"content":"Rename the parser"}}"#,
        r#"{"type":"assistant","sessionId":"s1","timestamp":"2020-01-01T00:00:01Z","message":{"content":[{"type":"text","text":"I will change kept.rs"}]}}"#,
        r#"{"type":"assistant","sessionId":"s1","timestamp":"2020-01-01T00:00:02Z","message":{"content":[{"type":"tool_use","id":"e1","name":"Edit","input":{"file_path":"kept.rs"}}]}}"#,
        r#"{"type":"assistant","sessionId":"s1","timestamp":"2020-01-01T00:00:03Z","message":{"content":[{"type":"text","text":"Done."}]}}"#,
    ]
    .join("\n")
}

#[test]
fn the_seam_answers_about_a_real_tree() {
    let bench = Bench::raise();

    // ── the queue ─────────────────────────────────────────────────────────
    let queue = bancada_app::commands::queue::queue().expect("a queue");
    let json = serde_json::to_value(&queue).unwrap();
    assert_eq!(json["watching"], 1);
    assert!(json["unreachable"].as_array().unwrap().is_empty(), "{json}");
    assert_eq!(
        json["wip"]["sessions_waiting"], 1,
        "a turn that ended long ago should be waiting: {json}"
    );
    // Content reaches the row only through the glance, never the engine.
    assert_eq!(json["glances"]["s1"]["title"], "Rename the parser");
    // This *is* a scratch cockpit — the configuration came from an
    // environment variable — so the window must say so.
    assert!(
        json["elsewhere"]
            .as_str()
            .is_some_and(|p| p.ends_with("config.json")),
        "a scratch configuration must announce itself: {json}"
    );

    // ── what is registered ────────────────────────────────────────────────
    let work = bancada_app::commands::work::work().expect("the work");
    assert_eq!(work.workspaces.len(), 1);
    let standing = &work.workspaces[0].projects[0];
    assert_eq!(standing.sessions, 1);
    assert!(standing.last_activity.is_some(), "a written log has a time");
    assert!(work.orphans.is_empty());

    // ── looking before registering ────────────────────────────────────────
    let preview = bancada_app::commands::preview::preview(
        bench.project().display().to_string(),
        "here".into(),
    )
    .expect("a preview");
    assert!(preview.reachable && preview.versioned);
    assert_eq!(preview.sessions, 1);

    // ── the review half ───────────────────────────────────────────────────
    let review = bancada_app::commands::review::review("thing".into(), Default::default())
        .expect("a review");
    assert!(review.unreachable.is_none(), "{:?}", review.unreachable);
    let changed: Vec<&str> = review.diff.files.iter().map(|f| f.path.as_str()).collect();
    assert!(changed.contains(&"kept.rs"), "{changed:?}");
    assert!(
        changed.contains(&"new.md"),
        "an untracked file is part of the work: {changed:?}"
    );
    assert!(
        review.diff.files.iter().all(|f| f.fresh),
        "nothing was vouched for yet"
    );

    // ── how much moved, without the diff ──────────────────────────────────
    // The footer sits on all four screens, so it counts through its own
    // call. Whatever it says has to agree with the diff beside it.
    let summary = bancada_app::commands::review::summary("thing".into()).expect("a summary");
    assert_eq!(
        summary.files,
        review.diff.files.len(),
        "the footer and the diff must count the same files: {summary:?}"
    );
    assert_eq!(
        (summary.added, summary.removed),
        (
            review.diff.files.iter().map(|f| f.added).sum(),
            review.diff.files.iter().map(|f| f.removed).sum(),
        ),
        "and the same lines: {summary:?}"
    );

    // ── telling a project not to ask ──────────────────────────────────────
    // The whole point of the count in `Muted`: silencing records how much
    // work there was, so a session that did not exist then lifts it. Driven
    // against the real bench, which has exactly one session log.
    let before = bancada_app::commands::queue::queue().expect("a queue");
    assert_eq!((before.asking(), before.silenced()), (1, 0));
    assert!(
        !before.groups().is_empty(),
        "the bench has something waiting"
    );

    let config = bancada_app::commands::setup::mute_project("thing".into(), true).expect("muted");
    let muted = config.projects[0].muted.expect("it says when");
    assert_eq!(muted.sessions, 1, "one log at the moment of silencing");

    let after = bancada_app::commands::queue::queue().expect("a queue");
    assert_eq!((after.asking(), after.silenced()), (0, 1));
    assert!(
        after.groups().is_empty(),
        "a silenced project contributes nothing: {:?}",
        after.groups()
    );
    assert_eq!(
        after.watching(),
        before.watching(),
        "still watched, still counted — silencing is about attention, not access"
    );

    // A session that was not there then is new work, and new work wakes it.
    std::fs::write(bench.log_dir().join("s2.jsonl"), "").expect("a second log");
    let woken = bancada_app::commands::queue::queue().expect("a queue");
    assert_eq!(
        (woken.asking(), woken.silenced()),
        (1, 0),
        "a silence you have to remember to lift is the forgetting this prevents"
    );

    bancada_app::commands::setup::mute_project("thing".into(), false).expect("unmuted");
    std::fs::remove_file(bench.log_dir().join("s2.jsonl")).expect("tidy");

    // ── the file pane ─────────────────────────────────────────────────────
    let listing = bancada_app::commands::tree::tree("thing".into(), None).expect("a tree");
    let names: Vec<&str> = listing.iter().map(|e| e.name.as_str()).collect();
    assert!(
        names.contains(&"kept.rs") && names.contains(&"new.md"),
        "{names:?}"
    );
    assert!(
        !names.contains(&".git"),
        "the repository's own plumbing is not content"
    );

    let text = bancada_app::commands::tree::file("thing".into(), "new.md".into()).unwrap();
    assert_eq!(text, "notes\n");
    assert!(
        bancada_app::commands::tree::file("thing".into(), "../config.json".into()).is_err(),
        "climbing out of the project must be refused"
    );

    // ── what git says about the tree ──────────────────────────────────────
    let w = bancada_app::commands::tree::worktree("thing".into()).expect("a worktree");
    assert_eq!(
        w.of("new.md"),
        Some(bancada_core::Track::Untracked),
        "the bench leaves one file git has never heard of: {w:?}"
    );
    assert_eq!(
        w.of("kept.rs"),
        Some(bancada_core::Track::Modified),
        "and one tracked change"
    );

    let paths = bancada_app::commands::tree::paths("thing".into()).expect("the paths");
    assert!(paths.contains(&"kept.rs".to_owned()));
    assert!(
        paths.contains(&"new.md".to_owned()),
        "`--others` includes what git has not been told about: {paths:?}"
    );

    // ── the history ───────────────────────────────────────────────────────
    // Driven against the same real repository. Every one of these shells out
    // to `git`, and the only way to know the arguments are right is to run
    // them somewhere a wrong one fails.
    let repo = bancada_app::commands::git::repo("thing".into()).expect("a repo");
    assert!(repo.is_git, "the bench project is a git repository");
    assert!(repo.head.is_some(), "and something is checked out by name");
    // No upstream on a fresh `git init`, and level is the honest reading.
    assert_eq!((repo.ahead, repo.behind), (0, 0));

    let log = bancada_app::commands::git::history("thing".into(), 0, 30).expect("a history");
    assert_eq!(log.len(), 1, "the bench has one commit");
    assert_eq!(log[0].subject, "first");
    assert_eq!(log[0].author, "T");
    assert!(log[0].when > 0, "a commit has a date");
    assert!(
        bancada_app::commands::git::history("thing".into(), 1, 30)
            .expect("a page past the end")
            .is_empty(),
        "skipping past the end is empty, not an error"
    );

    let refs = bancada_app::commands::git::branches("thing".into()).expect("branches");
    assert_eq!(refs.len(), 1);
    assert!(refs[0].current, "the only branch is the one we are on");

    let landed =
        bancada_app::commands::git::commit("thing".into(), log[0].sha.clone()).expect("the commit");
    assert_eq!(landed.commit.short, log[0].short);
    assert!(
        landed
            .diff
            .files
            .iter()
            .any(|f| f.path == "kept.rs" && f.status == bancada_core::Status::Added),
        "the first commit adds the file it committed: {:?}",
        landed.diff.files
    );
    assert!(
        bancada_app::commands::git::commit("thing".into(), "deadbeef".into()).is_err(),
        "a commit that is not there is an error, not an empty diff"
    );

    // A directory git was never told about is a normal thing for a project
    // to point at, and it answers rather than failing.
    let plain = serde_json::from_str(&format!(
        r#"{{"id":"plain","workspace":"personal","runtime":"here","path":"{}","weight":1,"idleAfterMinutes":1}}"#,
        bench.root.join("home").display()
    ))
    .unwrap();
    bancada_app::commands::setup::register_project(plain, None).expect("registered");
    let none = bancada_app::commands::git::repo("plain".into()).expect("an answer");
    assert!(!none.is_git, "a directory with no repository says so");
    // And the file list falls back to walking it. `ls-files` is one call in a
    // repository and nothing at all outside one, so the walk is the only way
    // the search box has anything to search.
    let walked = bancada_app::commands::tree::paths("plain".into()).expect("a walk");
    assert!(
        walked.iter().any(|p| p.ends_with("s1.jsonl")),
        "the walk did not recurse into a nested directory: {walked:?}"
    );
    assert!(
        !walked.iter().any(|p| p.contains(".git/")),
        "the walk went into a repository's own directory: {walked:?}"
    );
    assert!(
        bancada_app::commands::git::history("plain".into(), 0, 30).is_err(),
        "and asking it for a history is an error"
    );
    bancada_app::commands::setup::forget_project("plain".into()).expect("forgotten");

    // ── writing it back ───────────────────────────────────────────────────
    let after = bancada_app::commands::work::register_workspace(
        serde_json::from_str(r#"{"id":"client-x","export":"summary"}"#).unwrap(),
        None,
    )
    .expect("a saved workspace");
    assert_eq!(after.workspaces.len(), 2);

    let renamed = bancada_app::commands::work::register_workspace(
        serde_json::from_str(r#"{"id":"mine"}"#).unwrap(),
        Some("personal".into()),
    )
    .expect("a rename");
    assert!(
        renamed.projects.iter().all(|p| p.workspace == "mine"),
        "the rename left its projects behind: {renamed:?}"
    );

    assert!(
        bancada_app::commands::work::forget_workspace("mine".into()).is_err(),
        "forgetting a workspace that still holds work must be refused"
    );
    assert!(bancada_app::commands::work::forget_workspace("client-x".into()).is_ok());

    // Registering, renaming and forgetting a project — the same three the
    // settings screen calls, in the order somebody actually does them.
    let spare = serde_json::json!({
        "id": "spare",
        "workspace": "mine",
        "runtime": "here",
        "path": bench.project().display().to_string(),
        "weight": 3,
        "idleAfterMinutes": 5
    });
    let with_spare = bancada_app::commands::setup::register_project(
        serde_json::from_value(spare).unwrap(),
        None,
    )
    .expect("registered");
    assert_eq!(with_spare.projects.len(), 2);

    let renamed_project = bancada_app::commands::setup::register_project(
        serde_json::from_str(
            r#"{"id":"renamed","workspace":"mine","runtime":"here","path":"/tmp","weight":1,"idleAfterMinutes":1}"#,
        )
        .unwrap(),
        Some("spare".into()),
    )
    .expect("renamed");
    assert!(
        renamed_project.projects.iter().all(|p| p.id != "spare"),
        "a rename left the old entry behind: {renamed_project:?}"
    );

    let vm = serde_json::from_str(
        r#"{"id":"box","kind":"vm","prefix":["echo"],"configDir":"/state","sharedFs":true}"#,
    )
    .unwrap();
    assert!(bancada_app::commands::setup::register_runtime(vm).is_ok());

    // A configuration that would not parse is refused before it is written,
    // which is what keeps a save from producing a cockpit that will not open.
    let dangling = serde_json::from_str(
        r#"{"id":"bad","workspace":"nobody","runtime":"here","path":"/tmp","weight":1,"idleAfterMinutes":1}"#,
    )
    .unwrap();
    assert!(
        bancada_app::commands::setup::register_project(dangling, None).is_err(),
        "a project naming no workspace must not be saved"
    );

    let gone = bancada_app::commands::setup::forget_project("thing".into()).expect("forgotten");
    assert_eq!(gone.projects.len(), 1);
    assert!(bancada_app::commands::setup::forget_project("renamed".into()).is_ok());

    // ── and the machines ──────────────────────────────────────────────────
    let found = bancada_app::commands::setup::discover().expect("a probe");
    assert!(!found.is_empty(), "the registered runtime should be probed");

    let settings = bancada_app::commands::setup::settings().expect("settings");
    assert!(
        settings.runtimes.iter().any(|r| r.id == "this-machine"),
        "the machine it runs on is always there"
    );
}

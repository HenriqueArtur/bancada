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
        review.unannounced.iter().any(|p| p == "new.md"),
        "nobody announced new.md: {:?}",
        review.unannounced
    );
    assert!(
        review.diff.files.iter().all(|f| f.fresh),
        "nothing was vouched for yet"
    );

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

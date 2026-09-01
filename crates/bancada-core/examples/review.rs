//! What changed in a project, beside what its sessions said they would do.
//!
//! The headless twin of the review screen. It exists so the pipeline can be
//! checked without a window — and because a bug that only reproduces inside
//! a webview is a bug nobody can bisect.
//!
//! ```sh
//! cargo run -p bancada-core --example review -- <project-id>
//! BANCADA_CONFIG=/path/to/config.json cargo run -p bancada-core --example review
//! ```
// The configuration is read here, at the edge, exactly as the window does
// it — the example exists to be the same pipeline without the window.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Config, Review};
use bancada_runtime::{HostRuntime, Runtime};

fn main() {
    let path = std::env::var("BANCADA_CONFIG").unwrap_or_else(|_| {
        format!(
            "{}/.config/bancada/config.json",
            std::env::var("HOME").unwrap_or_default()
        )
    });
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let cockpit = Cockpit::new(
        Config::parse_with_home(
            &text,
            std::path::Path::new(&std::env::var("HOME").unwrap_or_default()),
        )
        .expect("configuration"),
    );

    let wanted = std::env::args().nth(1);
    let host = HostRuntime::local();

    for project in &cockpit.config().projects {
        if wanted.as_ref().is_some_and(|w| w != &project.id) {
            continue;
        }
        // The project's own runtime for the tree; the local one for the
        // logs, which the harness writes on this machine.
        let at = cockpit
            .config()
            .runtime_of(project)
            .expect("registered runtime")
            .open();

        println!("\n── {} ── {}", project.id, project.path);

        match cockpit.diff_of(project, &at) {
            Ok(diff) if diff.files.is_empty() => println!("  tree matches its last commit"),
            Ok(diff) => {
                for f in &diff.files {
                    println!("  {:<50} +{} −{}", f.path, f.added, f.removed);
                }
            }
            Err(why) => println!("  unreachable: {why}"),
        }

        for log in cockpit.scan(project, &host).logs {
            let Ok(bytes) = host.read_file(&log) else {
                continue;
            };
            let r = Review::of(&String::from_utf8_lossy(&bytes));
            if r.touched.is_empty() {
                continue;
            }
            let id = log.file_stem().unwrap_or_default().to_string_lossy();
            println!(
                "\n  {} — {} file(s) touched",
                &id[..8.min(id.len())],
                r.touched.len()
            );
            match &r.intent {
                Some(i) => println!("    said: {}", first_line(i)),
                None => println!("    said: nothing before it started"),
            }
            for p in &r.unannounced {
                println!("    unannounced: {p}");
            }
        }
    }
}

fn first_line(s: &str) -> String {
    let line = s.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
    if line.chars().count() > 96 {
        format!("{}…", line.chars().take(96).collect::<String>())
    } else {
        line.to_owned()
    }
}

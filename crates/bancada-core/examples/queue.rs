//! Print the queue, headless.
//!
//! The same pipeline the window shows, without the window — which is what
//! makes it useful for seeing whether the core works before deciding the
//! shell did something wrong.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Cockpit, Config};
use bancada_meta::Timestamp;
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
        .expect("config"),
    );
    let host = HostRuntime::local();
    let now = Timestamp::from_millis(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
    );

    let mut items = Vec::new();
    for project in &cockpit.config().projects {
        let scan = cockpit.scan(project, &host);
        println!("{} — {} log(s)", project.id, scan.logs.len());
        if let Some(why) = &scan.unreachable {
            println!("  unreachable: {why}");
        }
        // Folded per log, asked once. A newer session quiets the ones that
        // had already stopped, and that is a question about the whole
        // project rather than about any one file in it.
        let mut states = Vec::new();
        for log in scan.logs {
            let bytes = host.read_file(&log).expect("read");
            let facts = Cockpit::facts(&String::from_utf8_lossy(&bytes));
            let folded = Cockpit::states_of(&facts);
            println!(
                "  {}  {} facts → {} session(s)",
                log.file_name().unwrap_or_default().to_string_lossy(),
                facts.len(),
                folded.len()
            );
            states.extend(folded);
        }
        let q = Cockpit::queue_of(project, &cockpit.config().limits_of(project), &states, now);
        println!("  → {} item(s)", q.len());
        items.extend(q);
    }

    let (groups, wip) = Cockpit::present(items, now);
    println!(
        "\n── needs you ──  {} waiting · {} items",
        wip.sessions_waiting, wip.items
    );
    for g in &groups {
        println!("{}", g.session.as_str());
        for r in &g.items {
            println!(
                "   {:>6}min  {:?}   score {}",
                r.age_ms / 60_000,
                r.item.kind,
                r.score
            );
        }
    }
    if groups.is_empty() {
        println!("(nothing)");
    }
}

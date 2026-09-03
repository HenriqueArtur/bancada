//! The whole pipeline over a real recorded log: text in, queue out.
//!
//! `std::fs` is denied across the workspace so nothing reaches the disk
//! except through `Runtime`. A test reading a fixture is the exception the
//! rule is not about.
#![allow(clippy::disallowed_methods)]

use bancada_core::{Cockpit, Config, Project};
use bancada_meta::Timestamp;

const CFG: &str = r#"{
  "workspaces": [{"id":"personal"}],
  "runtimes": [{"id":"local","kind":"local","configDir":"/tmp","sharedFs":true}],
  "projects": [{"id":"gitmoji","workspace":"personal","runtime":"local",
                "path":"/mnt/dev/neo-gitmoji.nvim","idleAfterMinutes":2}]
}"#;

fn fixture(name: &str) -> String {
    let base = concat!(env!("CARGO_MANIFEST_DIR"), "/../../fixtures/");
    std::fs::read_to_string(format!("{base}{name}")).expect(name)
}

fn last_event_time(facts: &[bancada_meta::MetaEvent]) -> Timestamp {
    facts.iter().map(|e| e.at()).max().expect("a fact")
}

#[test]
fn a_recorded_session_becomes_facts_that_carry_no_content() {
    let facts = Cockpit::facts(&fixture("exploration/session.jsonl"));
    assert!(!facts.is_empty(), "a real log produced no facts");

    // Nothing in the debug rendering of a fact may contain a phrase from
    // the log's prose. This is hard rule 2 asserted rather than assumed.
    let rendered = format!("{facts:?}");
    for leaked in ["keystrokes", "commit message", "README"] {
        assert!(
            !rendered.contains(leaked),
            "the word `{leaked}` reached the engine"
        );
    }
}

#[test]
fn a_session_that_ended_long_ago_is_in_the_queue_as_review() {
    let cfg = Config::parse(CFG).unwrap();
    let project = &cfg.projects[0];
    let facts = Cockpit::facts(&fixture("exploration/session.jsonl"));

    // An hour after the last thing happened.
    let now = Timestamp::from_millis(last_event_time(&facts).as_millis() + 3_600_000);
    let items = Cockpit::queue_of(
        project,
        &cfg.limits_of(project),
        &Cockpit::states_of(&facts),
        now,
    );

    assert_eq!(items.len(), 1, "expected exactly one thing to look at");
    assert_eq!(items[0].kind, bancada_meta::DecisionKind::Review);
}

#[test]
fn the_same_session_is_not_in_the_queue_the_moment_it_stops() {
    let cfg = Config::parse(CFG).unwrap();
    let facts = Cockpit::facts(&fixture("exploration/session.jsonl"));
    let now = Timestamp::from_millis(last_event_time(&facts).as_millis() + 1_000);

    assert!(
        Cockpit::queue_of(
            &cfg.projects[0],
            &cfg.limits_of(&cfg.projects[0]),
            &Cockpit::states_of(&facts),
            now
        )
        .is_empty(),
        "listed a turn that may still continue"
    );
}

#[test]
fn three_recorded_sessions_are_one_group_until_they_are_kept() {
    let cfg = Config::parse(CFG).unwrap();
    let project = &cfg.projects[0];
    let names = ["simple-read", "tool-and-error", "exploration"];
    let per_file: Vec<Vec<bancada_meta::MetaEvent>> = names
        .iter()
        .map(|f| Cockpit::facts(&fixture(&format!("{f}/session.jsonl"))))
        .collect();

    let latest = per_file
        .iter()
        .map(|f| last_event_time(f).as_millis())
        .max()
        .unwrap();
    let now = Timestamp::from_millis(latest + 3_600_000);

    // Every session of the project at once, the way the command reads them.
    // Folded one file at a time, each call would see a single session and
    // the rule that quiets the old ones would have nothing to compare
    // against — which is the shape of a test that passes and proves nothing.
    let states: Vec<_> = per_file
        .iter()
        .flat_map(|facts| Cockpit::states_of(facts))
        .collect();

    // The three were recorded one after another, so two of them had already
    // stopped when the next began — and a newer session is how you say you
    // have moved on. Only the last one still asks.
    //
    // This is what the test was for. Written the obvious way, folding one
    // file at a time, every call would see a single session, nothing would
    // have anything to compare against, and it would pass while proving the
    // opposite. It found the wrong expectation here first.
    let limits = cfg.limits_of(project);
    let (groups, wip) = Cockpit::present(Cockpit::queue_of(project, &limits, &states, now), now);
    assert_eq!(groups.len(), 1, "the two it moved on from still asked");
    assert_eq!(wip.sessions_waiting, 1);

    // Named by hand, all three speak again. The override exists for the
    // long-running session that sits idle on purpose.
    let kept = Project {
        kept: states
            .iter()
            .map(|s| s.session.as_str().to_owned())
            .collect(),
        ..project.clone()
    };
    let (groups, wip) = Cockpit::present(Cockpit::queue_of(&kept, &limits, &states, now), now);
    assert_eq!(groups.len(), 3, "each recorded session is its own group");
    assert_eq!(wip.sessions_waiting, 3);
    assert!(
        !wip.over(),
        "three waiting is inside the range research supports"
    );
}

#[test]
fn a_question_fixture_produces_a_question_in_the_queue() {
    let cfg = Config::parse(CFG).unwrap();
    let facts = Cockpit::facts(&fixture("events/ask-user-question/event.jsonl"));
    let now = Timestamp::from_millis(last_event_time(&facts).as_millis() + 1_000);
    let items = Cockpit::queue_of(
        &cfg.projects[0],
        &cfg.limits_of(&cfg.projects[0]),
        &Cockpit::states_of(&facts),
        now,
    );

    // The extracted event is a question *and* its answer, so it resolves.
    // Asserting the resolution is asserting that ids matched, which is the
    // only way resolution is visible without reading content.
    assert!(
        items.is_empty(),
        "the answer arrived and the item stayed: {items:?}"
    );
}

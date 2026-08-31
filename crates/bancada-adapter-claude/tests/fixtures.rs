//! The acceptance criteria of `docs/specs/0002-session-log-parser.md`,
//! run against the recorded fixtures rather than against invented input.
//!
//! `std::fs` is denied across the workspace so that nothing reaches the
//! filesystem except through `Runtime` — hard rule 3. A test reading a
//! fixture off disk is the exception the rule is not about, and naming it
//! here is cheaper than narrowing the rule and losing it everywhere else.
#![allow(clippy::disallowed_methods)]
use bancada_adapter_claude::{Parsed, SessionLog, SkipReason};
use bancada_events::Event;

fn load(rel: &str) -> String {
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../../fixtures/");
    std::fs::read_to_string(format!("{p}{rel}")).unwrap_or_else(|e| panic!("{rel}: {e}"))
}

fn parse(rel: &str) -> Parsed {
    SessionLog::parse(&load(rel))
}

fn tool_names(p: &Parsed) -> Vec<&str> {
    p.events
        .iter()
        .filter_map(|e| match e {
            Event::ToolCall { name, .. } => Some(name.as_str()),
            _ => None,
        })
        .collect()
}

#[test]
fn criterion_1_a_plain_read_yields_the_read_and_the_prose() {
    let p = parse("simple-read/session.jsonl");
    assert!(
        tool_names(&p).contains(&"Read"),
        "no Read in {:?}",
        tool_names(&p)
    );
    assert!(
        p.events.iter().any(|e| matches!(
            e,
            Event::Text {
                role: bancada_events::Role::Assistant,
                ..
            }
        )),
        "no assistant prose"
    );
}

#[test]
fn criterion_2_both_shell_calls_yield_a_result() {
    let p = parse("tool-and-error/session.jsonl");
    let bash = tool_names(&p).iter().filter(|n| **n == "Bash").count();
    assert_eq!(bash, 2, "expected two Bash calls");

    let results: Vec<_> = p
        .events
        .iter()
        .filter_map(|e| match e {
            Event::ToolResult { ok, output, .. } => Some((*ok, output.as_str())),
            _ => None,
        })
        .collect();
    assert_eq!(results.len(), 2, "every call should have a result");

    // The command failed and the tool did not. `is_error` marks the tool
    // erroring, so a shell exiting 127 is a *successful* tool_result whose
    // content says otherwise. Asserting the surprise so a format change
    // that "fixes" it is visible rather than silent.
    let failing = results
        .iter()
        .find(|(_, out)| out.contains("EXIT_CODE=127"))
        .expect("the deliberate failure is in the fixture");
    assert!(
        failing.0,
        "a non-zero exit is not is_error — if this now fails, the format changed"
    );
}

#[test]
fn criterion_3_a_question_keeps_its_options_labels_descriptions_and_previews() {
    let p = parse("events/ask-user-question/event.jsonl");
    let q = p
        .events
        .iter()
        .find_map(|e| match e {
            Event::Asked { question, .. } => Some(question),
            _ => None,
        })
        .expect("no Asked event");

    assert_eq!(q.options.len(), 3);
    assert!(!q.header.is_empty(), "the header is what the card shows");
    for o in &q.options {
        assert!(!o.label.is_empty());
        assert!(!o.description.is_empty());
        assert!(o.preview.is_some(), "{} lost its preview", o.label);
    }
}

#[test]
fn criterion_4_an_unknown_line_type_is_named_and_parsing_continues() {
    let mut log = load("simple-read/session.jsonl");
    log.push_str(r#"{"type":"widget","sessionId":"s","timestamp":"2026-01-01T00:00:00.000Z"}"#);
    log.push('\n');
    let p = SessionLog::parse(&log);

    assert_eq!(p.unknown_types(), vec!["widget"]);
    assert!(
        tool_names(&p).contains(&"Read"),
        "an unknown line stopped the rest of the log"
    );
}

#[test]
fn criterion_5_a_malformed_line_costs_that_line_and_nothing_after_it() {
    let good = load("simple-read/session.jsonl");
    let whole = SessionLog::parse(&good);

    let mut lines: Vec<&str> = good.lines().collect();
    lines.insert(lines.len() / 2, r#"{"type":"assistant","mess"#);
    let torn = SessionLog::parse(&lines.join("\n"));

    assert_eq!(
        torn.events.len(),
        whole.events.len(),
        "a truncated line lost events around it"
    );
    assert!(
        torn.skipped
            .iter()
            .any(|s| matches!(s.reason, SkipReason::Malformed(_))),
        "the truncated line was not reported"
    );
}

#[test]
fn criterion_6_every_event_carries_its_session_and_a_real_timestamp() {
    for f in ["simple-read", "tool-and-error", "exploration"] {
        let p = parse(&format!("{f}/session.jsonl"));
        assert!(!p.events.is_empty(), "{f} produced nothing");
        for e in &p.events {
            assert!(
                !e.session().as_str().is_empty(),
                "{f}: event with no session"
            );
            assert!(e.at().as_millis() > 0, "{f}: event with no timestamp");
        }
    }
}

#[test]
fn criterion_7_parsing_twice_yields_the_same_thing() {
    let raw = load("exploration/session.jsonl");
    assert_eq!(SessionLog::parse(&raw), SessionLog::parse(&raw));
}

#[test]
fn nothing_in_the_fixtures_is_an_unknown_type_today() {
    for f in ["simple-read", "tool-and-error", "exploration"] {
        let p = parse(&format!("{f}/session.jsonl"));
        assert!(
            p.unknown_types().is_empty(),
            "{f} has unknown line types {:?} — the format moved",
            p.unknown_types()
        );
    }
}

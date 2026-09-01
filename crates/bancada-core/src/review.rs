use bancada_adapter_claude::SessionLog;
use bancada_events::{Event, Role};
use serde::Serialize;
use std::collections::BTreeSet;

/// A session's work, beside what it said it would do.
///
/// A raw diff is what a terminal already gives, and it is the thing that
/// makes reviewing agent work miserable: four hundred lines with no claim to
/// check them against. The intent is already in the log — the agent announced
/// it before acting — so putting the two side by side turns "read everything"
/// into "look at where it left the agreement".
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    /// What the agent said it would do, in its own words.
    pub intent: Option<String>,
    /// Files the agent named while announcing.
    pub announced: Vec<String>,
    /// Files it actually touched, from the tool calls.
    pub touched: Vec<String>,
    /// Touched and never announced. **The deviation** — the short list worth
    /// reading when the diff is long.
    pub unannounced: Vec<String>,
}

impl Review {
    /// Just the paths a piece of prose names.
    ///
    /// Split out so a caller holding several sessions' claims can pool them
    /// before deciding what went unannounced. Two agents in one tree is
    /// exactly the case a per-session list gets wrong: the file *was*
    /// announced, only not by the session that wrote it.
    pub fn of_text(text: &str) -> Self {
        Review {
            announced: paths_named_in(text).into_iter().collect(),
            intent: Some(text.to_owned()),
            ..Default::default()
        }
    }

    /// Read one session log and pair its claim with its actions.
    pub fn of(log: &str) -> Self {
        let parsed = SessionLog::parse(log);
        let intent = intent_of(&parsed.events);
        let touched = touched_by(&parsed.events);
        let announced: Vec<String> = intent
            .as_deref()
            .map(paths_named_in)
            .unwrap_or_default()
            .into_iter()
            .collect();

        let unannounced = touched
            .iter()
            .filter(|t| !announced.iter().any(|a| mentions(a, t)))
            .cloned()
            .collect();

        Review {
            intent,
            announced,
            touched,
            unannounced,
        }
    }
}

/// The last thing the agent said before it started acting.
///
/// Prose *after* the work is a report, not a claim, and reviewing against a
/// report is how a reviewer gets talked into agreeing.
fn intent_of(events: &[Event]) -> Option<String> {
    let first_action = events.iter().position(is_action)?;
    events[..first_action].iter().rev().find_map(|e| match e {
        Event::Text {
            role: Role::Assistant,
            content,
            ..
        } if !content.trim().is_empty() => Some(content.clone()),
        _ => None,
    })
}

const WRITERS: [&str; 4] = ["Edit", "Write", "NotebookEdit", "MultiEdit"];

fn is_action(e: &Event) -> bool {
    matches!(e, Event::ToolCall { name, .. } if WRITERS.contains(&name.as_str()))
}

fn touched_by(events: &[Event]) -> Vec<String> {
    let mut out = BTreeSet::new();
    for e in events {
        if let Event::ToolCall { name, input, .. } = e
            && WRITERS.contains(&name.as_str())
            && let Ok(v) = serde_json::from_str::<serde_json::Value>(input)
            && let Some(p) = v.get("file_path").and_then(|p| p.as_str())
        {
            out.insert(p.to_owned());
        }
    }
    out.into_iter().collect()
}

/// Paths the prose names.
///
/// Deliberately crude: anything with a slash and a dot. A cleverer parser
/// would find fewer false positives and more false negatives, and a missed
/// announcement shows up as a deviation that is not one — which trains you to
/// ignore the list.
fn paths_named_in(text: &str) -> BTreeSet<String> {
    text.split(|c: char| c.is_whitespace() || "`\"'()[],;".contains(c))
        .filter(|w| w.contains('/') && w.contains('.') && w.len() > 3)
        .map(|w| {
            w.trim_matches(|c: char| {
                !c.is_alphanumeric() && c != '/' && c != '.' && c != '-' && c != '_'
            })
            .to_owned()
        })
        .filter(|w| !w.is_empty())
        .collect()
}

/// A path announced as `src/db.rs` covers a touch of `/repo/src/db.rs`.
fn mentions(announced: &str, touched: &str) -> bool {
    touched.ends_with(announced) || announced.ends_with(touched)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn log(lines: &[&str]) -> String {
        lines.join("\n")
    }
    fn assistant(text: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:00Z","message":{{"content":[{{"type":"text","text":{}}}]}}}}"#,
            serde_json::to_string(text).unwrap()
        )
    }
    fn edit(path: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:01Z","message":{{"content":[{{"type":"tool_use","id":"t","name":"Edit","input":{{"file_path":"{path}"}}}}]}}}}"#
        )
    }

    #[test]
    fn the_claim_is_what_was_said_before_acting_not_after() {
        let l = log(&[
            &assistant("I will change src/db.rs"),
            &edit("/repo/src/db.rs"),
            &assistant("Done — I also rewrote everything else"),
        ]);
        assert!(Review::of(&l).intent.unwrap().starts_with("I will change"));
    }

    #[test]
    fn a_file_that_was_announced_is_not_a_deviation() {
        let l = log(&[
            &assistant("I will change src/db.rs"),
            &edit("/repo/src/db.rs"),
        ]);
        assert!(Review::of(&l).unannounced.is_empty());
    }

    #[test]
    fn a_file_touched_and_never_named_is_the_deviation() {
        let l = log(&[
            &assistant("I will change src/db.rs"),
            &edit("/repo/src/db.rs"),
            &edit("/repo/src/auth.rs"),
        ]);
        assert_eq!(Review::of(&l).unannounced, vec!["/repo/src/auth.rs"]);
    }

    #[test]
    fn work_with_no_claim_at_all_leaves_every_file_unannounced() {
        let l = log(&[&edit("/repo/a.rs"), &edit("/repo/b.rs")]);
        let r = Review::of(&l);
        assert!(r.intent.is_none());
        assert_eq!(r.unannounced.len(), 2, "silence is not agreement");
    }

    #[test]
    fn reading_a_file_is_not_touching_it() {
        let read = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:01Z","message":{"content":[{"type":"tool_use","id":"t","name":"Read","input":{"file_path":"/repo/x.rs"}}]}}"#;
        let l = log(&[&assistant("looking around"), read]);
        assert!(Review::of(&l).touched.is_empty());
    }

    #[test]
    fn a_session_that_changed_nothing_reviews_as_nothing() {
        let r = Review::of(&assistant("I had a look and there is nothing to do"));
        assert!(r.touched.is_empty() && r.unannounced.is_empty());
    }

    #[test]
    fn prose_alone_still_yields_the_paths_it_names() {
        let r = Review::of_text("I will touch `src/db.rs` and web/src/app.tsx");
        assert_eq!(r.announced.len(), 2);
        assert!(r.announced.contains(&"src/db.rs".to_owned()));
    }
    #[test]
    fn a_tool_call_before_any_prose_is_not_a_claim() {
        // Only prose can announce. A session that opens by reading a file
        // has said nothing, and the review has to know that.
        let read = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:00Z","message":{"content":[{"type":"tool_use","id":"r","name":"Read","input":{"file_path":"/repo/x.rs"}}]}}"#;
        let r = Review::of(&log(&[read, &edit("/repo/x.rs")]));
        assert!(r.intent.is_none());
    }
}

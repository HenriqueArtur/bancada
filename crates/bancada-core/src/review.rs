use bancada_adapter_claude::SessionLog;
use bancada_events::{Event, Role};
use bancada_meta::Timestamp;
use serde::Serialize;
use std::collections::BTreeSet;

/// A session's work, split into the turns it was asked for.
///
/// A raw diff is what a terminal already gives, and it is the thing that
/// makes reviewing agent work miserable: four hundred lines with no claim to
/// check them against. The claim is already in the log — the agent announced
/// it before acting — so putting the two side by side turns "read
/// everything" into "look at where it left the agreement".
///
/// **Per turn, not per session.** The first version read one claim from the
/// whole log: the last thing said before the *first* edit. That is right for
/// a session that does one thing, and a session is an afternoon. On a real
/// log it froze at event twenty of two thousand and every later file came
/// back unannounced, which is the failure the crude path matcher below is
/// written to avoid — an alarm that is always on is an alarm nobody reads.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    /// Oldest first, as the log has them. Turns that wrote nothing are not
    /// here: there is nothing to hold against a claim.
    pub episodes: Vec<Episode>,
}

/// One turn: what the agent said it would do, and what it then touched.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Episode {
    /// In its own words. `None` for a turn that acted without saying
    /// anything first.
    pub intent: Option<String>,
    /// Paths it actually wrote to, from the tool calls.
    pub touched: Vec<String>,
    /// When the first write landed, so several sessions can be read in one
    /// order.
    pub at: Timestamp,
}

impl Review {
    /// Read one session log and pair each turn's claim with its actions.
    pub fn of(log: &str) -> Self {
        let events = SessionLog::parse(log).events;
        Review {
            episodes: turns(&events).iter().filter_map(|t| episode(t)).collect(),
        }
    }

    /// Every path any turn wrote to.
    pub fn touched(&self) -> Vec<String> {
        let mut out: BTreeSet<&str> = BTreeSet::new();
        for e in &self.episodes {
            out.extend(e.touched.iter().map(String::as_str));
        }
        out.into_iter().map(str::to_owned).collect()
    }
}

/// Slice the log at each thing a person said.
///
/// The event model has no turn — `Event`'s own comment says so, and says
/// they are derived above the adapter rather than invented inside it. This
/// is that derivation, and it rests on the adapter keeping a tool's result
/// (`ToolResult`) apart from a person's words (`Text { role: User }`).
/// Were those one variant, every turn would end at every tool call.
fn turns(events: &[Event]) -> Vec<&[Event]> {
    let starts: Vec<usize> = events
        .iter()
        .enumerate()
        .filter(|(_, e)| {
            matches!(
                e,
                Event::Text {
                    role: Role::User,
                    ..
                }
            )
        })
        .map(|(i, _)| i)
        .collect();

    // Anything before the first thing a person said still happened, and a
    // session resumed from a summary begins exactly that way.
    let mut cuts = vec![0];
    cuts.extend(starts.iter().copied().filter(|&i| i > 0));
    cuts.push(events.len());

    cuts.windows(2)
        .map(|w| &events[w[0]..w[1]])
        .filter(|s| !s.is_empty())
        .collect()
}

/// One turn, if it wrote anything.
///
/// The claim is the last thing said **before the first write of this turn**.
/// Prose after the work is a report, not a claim, and reviewing against a
/// report is how a reviewer gets talked into agreeing.
fn episode(turn: &[Event]) -> Option<Episode> {
    let first = turn.iter().position(is_action)?;
    let intent = turn[..first].iter().rev().find_map(|e| match e {
        Event::Text {
            role: Role::Assistant,
            content,
            ..
        } if !content.trim().is_empty() => Some(content.clone()),
        _ => None,
    });

    Some(Episode {
        touched: touched_by(turn),
        at: turn[first].at(),
        intent,
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
    fn asked(text: &str) -> String {
        format!(
            r#"{{"type":"user","sessionId":"s","timestamp":"2026-01-01T00:00:00Z","message":{{"content":{}}}}}"#,
            serde_json::to_string(text).unwrap()
        )
    }
    fn edit(path: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:01Z","message":{{"content":[{{"type":"tool_use","id":"t","name":"Edit","input":{{"file_path":"{path}"}}}}]}}}}"#
        )
    }
    fn only(r: &Review) -> &Episode {
        assert_eq!(r.episodes.len(), 1, "{:?}", r.episodes);
        &r.episodes[0]
    }

    #[test]
    fn the_claim_is_what_was_said_before_acting_not_after() {
        let l = log(&[
            &assistant("I will change src/db.rs"),
            &edit("/repo/src/db.rs"),
            &assistant("Done — I also rewrote everything else"),
        ]);
        assert!(
            only(&Review::of(&l))
                .intent
                .as_ref()
                .unwrap()
                .starts_with("I will change")
        );
    }

    #[test]
    fn each_turn_carries_its_own_claim() {
        // The whole reason this is split. One claim per session froze at the
        // first thing ever said and called every later file a deviation.
        let l = log(&[
            &asked("do the first thing"),
            &assistant("I will change src/db.rs"),
            &edit("/repo/src/db.rs"),
            &asked("now do the second"),
            &assistant("I will change src/auth.rs"),
            &edit("/repo/src/auth.rs"),
        ]);
        let r = Review::of(&l);
        assert_eq!(r.episodes.len(), 2);
        assert!(r.episodes[0].touched == vec!["/repo/src/db.rs".to_owned()]);
        assert!(
            r.episodes[1]
                .intent
                .as_ref()
                .unwrap()
                .contains("src/auth.rs")
        );
    }

    #[test]
    fn a_turn_that_wrote_nothing_is_not_an_episode() {
        // Nothing to hold against a claim. A question answered, a file read,
        // a plan discussed — none of it belongs on a review screen.
        let l = log(&[
            &asked("what do you think?"),
            &assistant("I think we should wait"),
            &asked("fine, do it"),
            &assistant("I will change src/db.rs"),
            &edit("/repo/src/db.rs"),
        ]);
        assert_eq!(Review::of(&l).episodes.len(), 1);
    }

    #[test]
    fn work_before_anybody_said_anything_is_still_a_turn() {
        // A session resumed from a summary begins mid-thought, with no user
        // line above the first edit. Dropping that would lose the work.
        let l = log(&[&assistant("carrying on"), &edit("/repo/a.rs")]);
        assert_eq!(Review::of(&l).episodes.len(), 1);
    }

    #[test]
    fn a_tool_result_does_not_end_a_turn() {
        // Claude Code files a tool's output under the user's role. Read as
        // speech it would cut a turn at every command, and the claim above
        // the next edit would be lost.
        let result = r#"{"type":"user","sessionId":"s","timestamp":"2026-01-01T00:00:00Z","message":{"content":[{"type":"tool_result","tool_use_id":"t","content":"ok"}]}}"#;
        let l = log(&[
            &assistant("I will change src/db.rs"),
            result,
            &edit("/repo/src/db.rs"),
        ]);
        let r = Review::of(&l);
        assert_eq!(r.episodes.len(), 1);
        assert!(
            only(&r).intent.is_some(),
            "the claim was cut off from its work"
        );
    }

    #[test]
    fn work_with_no_claim_at_all_leaves_every_file_unannounced() {
        let l = log(&[&edit("/repo/a.rs"), &edit("/repo/b.rs")]);
        let r = Review::of(&l);
        assert!(only(&r).intent.is_none(), "silence is not a claim");
    }

    #[test]
    fn reading_a_file_is_not_touching_it() {
        let read = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:01Z","message":{"content":[{"type":"tool_use","id":"t","name":"Read","input":{"file_path":"/repo/x.rs"}}]}}"#;
        let l = log(&[&assistant("looking around"), read]);
        assert!(Review::of(&l).touched().is_empty());
    }

    #[test]
    fn a_session_that_changed_nothing_reviews_as_nothing() {
        let r = Review::of(&assistant("I had a look and there is nothing to do"));
        assert!(r.episodes.is_empty());
        assert!(r.touched().is_empty());
    }

    #[test]
    fn a_tool_call_before_any_prose_is_not_a_claim() {
        // Only prose can announce. A turn that opens by reading a file has
        // said nothing, and the review has to know that.
        let read = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:00Z","message":{"content":[{"type":"tool_use","id":"r","name":"Read","input":{"file_path":"/repo/x.rs"}}]}}"#;
        let r = Review::of(&log(&[read, &edit("/repo/x.rs")]));
        assert!(only(&r).intent.is_none());
    }

    #[test]
    fn an_episode_is_stamped_by_the_write_that_started_it() {
        // Several sessions are read in one order on the screen, and the
        // order has to come from when the work happened.
        let l = log(&[&assistant("go"), &edit("/repo/a.rs")]);
        assert_eq!(only(&Review::of(&l)).at.as_millis(), 1_767_225_601_000);
    }
}

use bancada_adapter_claude::SessionLog;
use bancada_events::{Event, Question, Role};
use bancada_meta::Timestamp;
use serde::Serialize;
use std::collections::{HashMap, HashSet};

/// One session's conversation, from the end.
///
/// From the end because that is where a conversation is: you open it to see
/// what just happened, not to read a morning. A page at a time, the same
/// shape the commit history already uses — a log here is thirty-five
/// megabytes and two thousand events, and handing that across the seam is
/// the mistake that once stopped the diff screen responding, with a worse
/// number behind it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    /// Oldest first, so it reads downward like the conversation it is.
    pub said: Vec<Said>,
    /// Whether asking for another page would bring anything.
    pub more: bool,
}

/// One entry in the thread.
///
/// A union rather than a struct with empty fields: a run of tool calls has
/// no speaker and no words, and modelling it as an agent message with a
/// blank body is how a screen ends up drawing an empty bubble.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Said {
    You {
        text: String,
        at: Timestamp,
    },
    Agent {
        text: String,
        at: Timestamp,
    },
    /// The agent asked rather than said. The options are already structured
    /// in the log, so a screen draws them rather than parsing.
    Asked {
        text: String,
        at: Timestamp,
        question: Question,
    },
    /// What it did between two things it said.
    ///
    /// Collapsed into one entry per run. A working turn is thirty calls and
    /// four sentences; one entry per call would bury the sentences, which
    /// are the part a supervisor is reading for.
    Steps {
        at: Timestamp,
        steps: Vec<Step>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    pub tool: String,
    /// The one thing it acted on — the path, the command, the pattern.
    ///
    /// Summarised here rather than in the webview: the whole input is a
    /// hundred kilobytes of edit for a line that shows forty characters,
    /// and sending it so the other side can throw it away is the payload
    /// mistake the diff screen already made once.
    pub target: String,
    /// `false` only when the log says the tool itself failed. A shell
    /// exiting 127 is a *successful* tool result whose content says so.
    pub ok: bool,
}

impl Chat {
    /// The last `take` entries, skipping `skip` from the end.
    ///
    /// `root` is the project as the log spells it, so a path can be shown
    /// the way you would say it out loud rather than from the volume root.
    pub fn of(log: &str, root: &str, skip: usize, take: usize) -> Self {
        let events = SessionLog::parse(log).events;
        let all = thread(&events, root);

        let end = all.len().saturating_sub(skip);
        let start = end.saturating_sub(take);
        Chat {
            more: start > 0,
            said: all[start..end].to_vec(),
        }
    }
}

/// The events as a thread, with runs of tool calls folded into one entry.
fn thread(events: &[Event], root: &str) -> Vec<Said> {
    let failed = failures(events);
    let mut out: Vec<Said> = Vec::new();
    let mut run: Vec<Step> = Vec::new();
    let mut began = Timestamp::from_millis(0);

    for e in events {
        match e {
            Event::ToolCall {
                at,
                id,
                name,
                input,
                ..
            } => {
                if run.is_empty() {
                    began = *at;
                }
                run.push(Step {
                    tool: name.clone(),
                    target: target(input, root),
                    ok: !failed.contains(id.as_str()),
                });
            }
            _ => {
                if let Some(s) = spoken(e) {
                    // Flushed only when somebody speaks, so a run split by a
                    // tool result stays one run rather than becoming two.
                    if !run.is_empty() {
                        out.push(Said::Steps {
                            at: began,
                            steps: std::mem::take(&mut run),
                        });
                    }
                    out.push(s);
                }
            }
        }
    }
    if !run.is_empty() {
        out.push(Said::Steps {
            at: began,
            steps: run,
        });
    }
    out
}

/// The ids of the calls the log says failed.
fn failures(events: &[Event]) -> HashSet<&str> {
    events
        .iter()
        .filter_map(|e| match e {
            Event::ToolResult { id, ok: false, .. } => Some(id.as_str()),
            _ => None,
        })
        .collect()
}

fn spoken(e: &Event) -> Option<Said> {
    match e {
        Event::Asked { at, question, .. } => Some(Said::Asked {
            // The prompt is the message. A question with a header and no
            // prompt is one the harness spelled the short way, and the
            // header is then the only words there are.
            text: if question.prompt.trim().is_empty() {
                question.header.clone()
            } else {
                question.prompt.clone()
            },
            at: *at,
            question: question.clone(),
        }),
        Event::Text {
            at, role, content, ..
        } => {
            // A person's words carry the harness's own notes inside them,
            // and those are plumbing rather than speech.
            let text = match role {
                Role::User => crate::glance::strip_reminders(content),
                Role::Assistant => content.trim().to_owned(),
            };
            if text.is_empty() {
                return None;
            }
            Some(match role {
                Role::User => Said::You { text, at: *at },
                Role::Assistant => Said::Agent { text, at: *at },
            })
        }
        _ => None,
    }
}

/// The tool input, as the one thing worth reading in it.
///
/// By convention rather than by tool name: every harness spells its own
/// tools differently, and a table of names here would be a list of one
/// harness's vocabulary pretending to be the model.
fn target(input: &str, root: &str) -> String {
    const NAMES: [&str; 8] = [
        "file_path",
        "path",
        "command",
        "pattern",
        "url",
        "query",
        "prompt",
        "description",
    ];
    const MOST: usize = 120;

    let Ok(v) = serde_json::from_str::<HashMap<String, serde_json::Value>>(input) else {
        return String::new();
    };
    let found = NAMES
        .iter()
        .find_map(|n| v.get(*n).and_then(serde_json::Value::as_str))
        // Nothing matched: the first string the input carries is a better
        // guess than nothing, and a tool nobody here has seen still has a
        // subject somewhere in it.
        .or_else(|| {
            let mut keys: Vec<_> = v.keys().collect();
            keys.sort();
            keys.into_iter()
                .find_map(|k| v.get(k).and_then(serde_json::Value::as_str))
        })
        .unwrap_or_default();

    // The separator goes only when the root actually matched. Stripped
    // unconditionally, `/etc/hosts` became `etc/hosts` — a path that reads
    // as relative to the project and is not.
    let said = match found.strip_prefix(root) {
        Some(rest) => rest.strip_prefix('/').unwrap_or(rest),
        None => found,
    };
    // One line. A heredoc in a shell command is forty lines that would each
    // take a row of a list whose whole point is one row per call.
    let one = said.lines().next().unwrap_or_default().trim();
    if one.chars().count() > MOST {
        format!("{}…", one.chars().take(MOST).collect::<String>())
    } else {
        one.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assistant(text: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:02Z","message":{{"content":[{{"type":"text","text":{}}}]}}}}"#,
            serde_json::to_string(text).unwrap()
        )
    }
    fn user(text: &str) -> String {
        format!(
            r#"{{"type":"user","sessionId":"s","timestamp":"2026-01-01T00:00:01Z","message":{{"content":{}}}}}"#,
            serde_json::to_string(text).unwrap()
        )
    }
    fn call(id: &str, name: &str, input: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:02Z","message":{{"content":[{{"type":"tool_use","id":"{id}","name":"{name}","input":{input}}}]}}}}"#
        )
    }
    fn broke(id: &str) -> String {
        format!(
            r#"{{"type":"user","sessionId":"s","timestamp":"2026-01-01T00:00:03Z","message":{{"content":[{{"type":"tool_result","tool_use_id":"{id}","is_error":true,"content":"boom"}}]}}}}"#
        )
    }
    const ASKED: &str = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:03Z","message":{"content":[{"type":"tool_use","id":"q","name":"AskUserQuestion","input":{"questions":[{"question":"Which way?","header":"Route","options":[{"label":"Left","description":"west"}]}]}}]}}"#;

    fn log(lines: &[&str]) -> String {
        lines.join("\n")
    }
    fn talk(n: usize) -> String {
        (0..n)
            .map(|i| user(&format!("line {i}")))
            .collect::<Vec<_>>()
            .join("\n")
    }
    fn chat(raw: &str) -> Chat {
        Chat::of(raw, "/w/p", 0, 50)
    }
    fn words(s: &Said) -> &str {
        match s {
            Said::You { text, .. } | Said::Agent { text, .. } | Said::Asked { text, .. } => text,
            Said::Steps { .. } => "",
        }
    }
    fn steps(s: &Said) -> &[Step] {
        match s {
            Said::Steps { steps, .. } => steps,
            _ => &[],
        }
    }

    #[test]
    fn both_sides_are_in_it_and_it_reads_downward() {
        let c = chat(&log(&[&user("do it"), &assistant("done")]));
        assert_eq!(c.said.len(), 2);
        assert!(matches!(c.said[0], Said::You { .. }));
        assert_eq!(words(&c.said[0]), "do it");
        assert!(matches!(c.said[1], Said::Agent { .. }));
    }

    #[test]
    fn the_last_page_is_the_end_of_the_conversation() {
        // Where a conversation is. You open it to see what just happened.
        let c = Chat::of(&talk(10), "/w/p", 0, 3);
        assert_eq!(c.said.len(), 3);
        assert_eq!(words(&c.said[2]), "line 9");
        assert!(c.more, "there are older ones");
    }

    #[test]
    fn skipping_walks_backwards_a_page_at_a_time() {
        let c = Chat::of(&talk(10), "/w/p", 3, 3);
        assert_eq!(words(&c.said[0]), "line 4");
        assert_eq!(words(&c.said[2]), "line 6");
    }

    #[test]
    fn reaching_the_beginning_says_there_is_no_more() {
        let c = Chat::of(&talk(4), "/w/p", 0, 10);
        assert_eq!(c.said.len(), 4);
        assert!(!c.more);
    }

    #[test]
    fn skipping_past_the_beginning_is_empty_rather_than_a_panic() {
        let c = Chat::of(&talk(4), "/w/p", 99, 3);
        assert!(c.said.is_empty());
        assert!(!c.more);
    }

    #[test]
    fn a_question_is_a_message_and_keeps_its_options() {
        let c = chat(&log(&[&user("go"), ASKED]));
        let last = c.said.last().expect("something");
        assert_eq!(words(last), "Which way?");
        assert!(
            matches!(last, Said::Asked { question, .. } if question.options.len() == 1),
            "expected a question with one option, got {last:?}"
        );
    }

    #[test]
    fn a_question_with_no_prompt_is_read_by_its_header() {
        // A harness may spell a question the short way. The header is then
        // the only words there are, and an empty bubble is not a question.
        const SHORT: &str = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:03Z","message":{"content":[{"type":"tool_use","id":"q","name":"AskUserQuestion","input":{"questions":[{"question":"  ","header":"Route","options":[{"label":"Left","description":"west"}]}]}}]}}"#;
        assert_eq!(words(&chat(&log(&[SHORT])).said[0]), "Route");
    }

    #[test]
    fn the_harness_own_notes_are_not_words_the_person_said() {
        let c = chat(&log(&[&user(
            "do it <system-reminder>be careful</system-reminder>",
        )]));
        assert_eq!(words(&c.said[0]), "do it");
    }

    #[test]
    fn a_message_that_is_only_a_reminder_is_not_a_message() {
        let c = chat(&log(&[
            &user("<system-reminder>plumbing</system-reminder>"),
            &user("the real one"),
        ]));
        assert_eq!(c.said.len(), 1);
        assert_eq!(words(&c.said[0]), "the real one");
    }

    #[test]
    fn a_slash_command_is_a_bubble_saying_the_command() {
        // The conversation shows the same turn the card does, so the markup
        // came out raw in both places. What it printed is not a bubble at
        // all: an empty `<local-command-stdout>` is nobody speaking.
        let c = chat(&log(&[
            &user("<command-name>/clear</command-name>\n            <command-args></command-args>"),
            &user("<local-command-stdout></local-command-stdout>"),
        ]));
        assert_eq!(c.said.len(), 1);
        assert_eq!(words(&c.said[0]), "/clear");
    }

    #[test]
    fn blank_prose_beside_a_tool_call_is_not_a_message() {
        // The harness writes one. Kept, every working session's conversation
        // is half empty bubbles.
        let c = chat(&log(&[&assistant("   "), &assistant("real")]));
        assert_eq!(c.said.len(), 1);
    }

    #[test]
    fn an_empty_log_is_an_empty_conversation() {
        assert_eq!(chat(""), Chat::default());
    }

    // ── what it did between two things it said ───────────────────────────

    #[test]
    fn a_message_and_a_run_of_calls_are_not_the_same_kind_of_thing() {
        // One says something and does nothing; the other does things and
        // says nothing. Drawn as one shape, every working turn would carry
        // an empty bubble.
        let c = chat(&log(&[
            &assistant("looking"),
            &call("a", "Read", r#"{"file_path":"/w/p/x"}"#),
        ]));
        assert_eq!(words(&c.said[0]), "looking");
        assert!(steps(&c.said[0]).is_empty(), "a message did nothing");
        assert_eq!(words(&c.said[1]), "", "a run of calls said nothing");
        assert_eq!(steps(&c.said[1]).len(), 1);
    }

    #[test]
    fn a_run_of_calls_is_one_entry_between_the_two_messages() {
        let c = chat(&log(&[
            &assistant("looking"),
            &call("a", "Read", r#"{"file_path":"/w/p/src/x.rs"}"#),
            &call("b", "Bash", r#"{"command":"cargo test"}"#),
            &assistant("done"),
        ]));
        assert_eq!(
            c.said.len(),
            3,
            "message, steps, message — got {:?}",
            c.said
        );
        assert_eq!(steps(&c.said[1]).len(), 2);
        assert_eq!(steps(&c.said[1])[0].tool, "Read");
    }

    #[test]
    fn a_result_arriving_between_two_calls_does_not_split_the_run() {
        // Every call is followed by its result, so a run flushed on anything
        // but speech would be one entry per call — which is the shape this
        // exists to avoid.
        let c = chat(&log(&[
            &call("a", "Read", r#"{"file_path":"/w/p/x"}"#),
            &broke("a"),
            &call("b", "Read", r#"{"file_path":"/w/p/y"}"#),
        ]));
        assert_eq!(c.said.len(), 1);
        assert_eq!(steps(&c.said[0]).len(), 2);
    }

    #[test]
    fn a_call_the_log_says_failed_is_marked_and_the_others_are_not() {
        let c = chat(&log(&[
            &call("a", "Bash", r#"{"command":"make check"}"#),
            &broke("a"),
            &call("b", "Bash", r#"{"command":"cargo fmt"}"#),
        ]));
        let s = steps(&c.said[0]);
        assert!(!s[0].ok, "the log said this one failed");
        assert!(s[1].ok);
    }

    #[test]
    fn a_path_is_shown_the_way_you_would_say_it() {
        let c = chat(&log(&[&call(
            "a",
            "Read",
            r#"{"file_path":"/w/p/src/x.rs"}"#,
        )]));
        assert_eq!(steps(&c.said[0])[0].target, "src/x.rs");
    }

    #[test]
    fn a_path_outside_the_project_keeps_every_segment_it_has() {
        // Shortening it against a root it is not under would produce a path
        // that reads as relative and is not.
        let c = chat(&log(&[&call("a", "Read", r#"{"file_path":"/etc/hosts"}"#)]));
        assert_eq!(steps(&c.said[0])[0].target, "/etc/hosts");
    }

    #[test]
    fn a_command_is_one_line_however_many_it_was_written_on() {
        let c = chat(&log(&[&call(
            "a",
            "Bash",
            r#"{"command":"cat <<EOF\nline\nEOF"}"#,
        )]));
        assert_eq!(steps(&c.said[0])[0].target, "cat <<EOF");
    }

    #[test]
    fn a_very_long_command_is_cut_rather_than_sent_whole() {
        let long = "x".repeat(400);
        let c = chat(&log(&[&call(
            "a",
            "Bash",
            &format!(r#"{{"command":"{long}"}}"#),
        )]));
        let said = &steps(&c.said[0])[0].target;
        assert_eq!(said.chars().count(), 121, "120 and the ellipsis");
        assert!(said.ends_with('…'));
    }

    #[test]
    fn a_tool_nobody_here_has_seen_still_shows_its_subject() {
        // No table of tool names: every harness spells its own differently.
        let c = chat(&log(&[&call("a", "Weird", r#"{"zzz":"the subject"}"#)]));
        assert_eq!(steps(&c.said[0])[0].target, "the subject");
    }

    #[test]
    fn a_call_the_log_recorded_no_input_for_is_still_a_step() {
        // The harness writes `input` on every call it has ever written, and
        // a missing one arrives here as an empty string rather than as `{}`.
        let raw = r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:02Z","message":{"content":[{"type":"tool_use","id":"a","name":"Bare"}]}}"#;
        let c = chat(&log(&[raw]));
        assert_eq!(steps(&c.said[0])[0].tool, "Bare");
        assert_eq!(steps(&c.said[0])[0].target, "");
    }

    #[test]
    fn a_tool_with_nothing_readable_in_it_is_still_a_step() {
        let c = chat(&log(&[&call("a", "Nothing", r#"{"n":1}"#)]));
        assert_eq!(steps(&c.said[0])[0].tool, "Nothing");
        assert_eq!(steps(&c.said[0])[0].target, "");
    }

    #[test]
    fn a_question_is_speech_and_not_a_step() {
        // It arrives as a tool call in the log. Folded into a run it would
        // vanish behind a disclosure triangle — the one entry that must not.
        let c = chat(&log(&[ASKED]));
        assert!(matches!(c.said[0], Said::Asked { .. }));
    }
}

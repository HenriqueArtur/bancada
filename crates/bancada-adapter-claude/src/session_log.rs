use crate::{Parsed, Skip};
use bancada_events::{Event, Question, QuestionOption, Role};
use bancada_meta::{SessionId, Timestamp};
use serde_json::Value;

/// Known line types that carry no event we model.
///
/// Listed rather than defaulted: a type moving out of this list is the
/// format changing, and a default would hide that.
const NOT_EVENTS: &[&str] = &[
    "attachment",
    "queue-operation",
    "last-prompt",
    "ai-title",
    "mode",
    "system",
    "file-history-delta",
    "file-history-snapshot",
];

/// One harness's session log.
pub struct SessionLog;

impl SessionLog {
    /// Parse a whole log. Pure: text in, events out, no clock, no I/O.
    pub fn parse(input: &str) -> Parsed {
        let mut out = Parsed::default();
        for (i, raw) in input.lines().enumerate() {
            let no = i + 1;
            if raw.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<Value>(raw) {
                Err(e) => out.skipped.push(Skip::malformed(no, e.to_string())),
                Ok(v) => Self::line(&v, no, &mut out),
            }
        }
        out
    }

    fn line(v: &Value, no: usize, out: &mut Parsed) {
        let Some(kind) = v.get("type").and_then(Value::as_str) else {
            out.skipped.push(Skip::malformed(no, "no `type`"));
            return;
        };
        let (Some(session), Some(at)) = (session_of(v), stamp_of(v)) else {
            out.skipped
                .push(Skip::malformed(no, "no `sessionId` or no `timestamp`"));
            return;
        };

        match kind {
            "assistant" => assistant(v, &session, at, out),
            // `isMeta` is the harness annotating its own transcript — an
            // image's dimensions, a note about a local command — wearing the
            // user's role. Reported as a skip rather than as speech, so
            // `Text { role: User }` can be trusted to mean a person said
            // this. Anything deriving turns from the log splits on exactly
            // that, and a turn boundary at every screenshot is no boundary.
            "user" if v.get("isMeta").and_then(Value::as_bool).unwrap_or(false) => {
                out.skipped.push(Skip::not_an_event(no, "user:isMeta"));
            }
            "user" => user(v, &session, at, no, out),
            k if NOT_EVENTS.contains(&k) => out.skipped.push(Skip::not_an_event(no, k)),
            k => out.skipped.push(Skip::unknown(no, k)),
        }
    }
}

fn session_of(v: &Value) -> Option<SessionId> {
    v.get("sessionId")
        .or_else(|| v.get("session_id"))
        .and_then(Value::as_str)
        .map(SessionId::new)
}

/// `2026-08-31T23:12:40.222Z` into milliseconds.
fn stamp_of(v: &Value) -> Option<Timestamp> {
    let raw = v.get("timestamp")?.as_str()?;
    chrono::DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|d| Timestamp::from_millis(d.timestamp_millis()))
}

fn text_of(b: &Value, key: &str) -> String {
    b.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn assistant(v: &Value, session: &SessionId, at: Timestamp, out: &mut Parsed) {
    let msg = v.get("message");

    if let Some(blocks) = msg.and_then(|m| m.get("content")).and_then(Value::as_array) {
        for b in blocks {
            match b.get("type").and_then(Value::as_str) {
                Some("text") => out.events.push(Event::Text {
                    session: session.clone(),
                    at,
                    role: Role::Assistant,
                    content: text_of(b, "text"),
                }),
                Some("thinking") => out.events.push(Event::Thinking {
                    session: session.clone(),
                    at,
                    content: text_of(b, "thinking"),
                }),
                Some("tool_use") => tool_use(b, session, at, out),
                _ => {}
            }
        }
    }

    // Usage rides on the assistant message, not on a turn boundary. There
    // is no turn boundary in this format.
    if let Some(u) = msg.and_then(|m| m.get("usage")) {
        let n = |k: &str| u.get(k).and_then(Value::as_u64).unwrap_or(0);
        out.events.push(Event::Usage {
            session: session.clone(),
            at,
            input_tokens: n("input_tokens"),
            output_tokens: n("output_tokens"),
            cache_read_tokens: n("cache_read_input_tokens"),
            cache_creation_tokens: n("cache_creation_input_tokens"),
        });
    }
}

fn tool_use(b: &Value, session: &SessionId, at: Timestamp, out: &mut Parsed) {
    let id = text_of(b, "id");
    let name = text_of(b, "name");
    if name == "AskUserQuestion"
        && let Some(q) = question_of(b)
    {
        out.events.push(Event::Asked {
            session: session.clone(),
            at,
            id,
            question: q,
        });
        return;
    }
    out.events.push(Event::ToolCall {
        session: session.clone(),
        at,
        id,
        name,
        input: b.get("input").map(Value::to_string).unwrap_or_default(),
    });
}

/// The first question of an `AskUserQuestion` call.
///
/// One rather than all: the log carries an array, every recorded call has
/// held exactly one, and modelling a list nothing produces would be
/// modelling a guess. A second one arriving is a fixture away.
fn question_of(b: &Value) -> Option<Question> {
    let q = b.get("input")?.get("questions")?.as_array()?.first()?;
    Some(Question {
        header: text_of(q, "header"),
        prompt: text_of(q, "question"),
        multi: q
            .get("multiSelect")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        options: q
            .get("options")
            .and_then(Value::as_array)
            .map(|os| {
                os.iter()
                    .map(|o| QuestionOption {
                        label: text_of(o, "label"),
                        description: text_of(o, "description"),
                        preview: o.get("preview").and_then(Value::as_str).map(str::to_owned),
                    })
                    .collect()
            })
            .unwrap_or_default(),
    })
}

/// A turn the harness wrote *about* a local command rather than words.
///
/// A slash command reaches the log wearing the user's role, spelled as tags
/// and indented as it was in the terminal:
///
/// ```text
/// <command-name>/clear</command-name>
///             <command-message>clear</command-message>
///             <command-args></command-args>
/// ```
///
/// and whatever it printed arrives as a second turn of
/// `<local-command-stdout>`. Both used to pass through as the person's own
/// words, so after `/clear` the session card read the markup back at you —
/// three tags under a heading that says "What you asked for".
enum Local {
    /// The command as it was typed.
    Typed(String),
    /// What the command printed, or the harness's caveat about it.
    Echo,
}

/// The harness's spelling of a local command, if that is what this turn is.
fn local(text: &str) -> Option<Local> {
    let t = text.trim_start();
    if t.starts_with("<local-command-stdout>") || t.starts_with("<local-command-caveat>") {
        return Some(Local::Echo);
    }
    // Only when the turn *begins* with the tag. Somebody pasting it to
    // report the bug is still somebody speaking — which is how this one
    // arrived, and matching anywhere would have eaten the report.
    if !t.starts_with("<command-name>") {
        return None;
    }
    let name = between(t, "command-name")?;
    // Every recorded invocation carries this tag and every one is empty, so
    // the joined form is unproven. Dropping the tag instead would show
    // `/loop` for `/loop 5m` — losing the half that says what was asked.
    let args = between(t, "command-args").unwrap_or_default();
    Some(Local::Typed(if args.is_empty() {
        name.to_owned()
    } else {
        format!("{name} {args}")
    }))
}

/// What one `<tag>…</tag>` holds, trimmed. `None` if it is not closed.
fn between<'a>(text: &'a str, tag: &str) -> Option<&'a str> {
    let rest = &text[text.find(&format!("<{tag}>"))? + tag.len() + 2..];
    Some(rest[..rest.find(&format!("</{tag}>"))?].trim())
}

fn user(v: &Value, session: &SessionId, at: Timestamp, no: usize, out: &mut Parsed) {
    let Some(content) = v.get("message").and_then(|m| m.get("content")) else {
        return;
    };

    // A human turn spells content as a bare string.
    if let Some(s) = content.as_str() {
        let said = match local(s) {
            // Nobody wrote it. Kept as speech it became the last thing you
            // said, so a session that had just printed `Login successful`
            // reported that as what you asked the agent for.
            Some(Local::Echo) => {
                out.skipped
                    .push(Skip::not_an_event(no, "user:local-command"));
                return;
            }
            Some(Local::Typed(cmd)) => cmd,
            None => s.to_owned(),
        };
        out.events.push(Event::Text {
            session: session.clone(),
            at,
            role: Role::User,
            content: said,
        });
        return;
    }

    for b in content.as_array().into_iter().flatten() {
        if b.get("type").and_then(Value::as_str) == Some("tool_result") {
            out.events.push(Event::ToolResult {
                session: session.clone(),
                at,
                id: text_of(b, "tool_use_id"),
                // `is_error` is the *tool* failing, not the command. A
                // shell exiting 127 is a successful tool_result whose
                // content says so — see docs/RISKS.md.
                ok: !b.get("is_error").and_then(Value::as_bool).unwrap_or(false),
                output: b
                    .get("content")
                    .map(|c| {
                        c.as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| c.to_string())
                    })
                    .unwrap_or_default(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SkipReason;

    fn line(kind: &str, body: &str) -> String {
        format!(
            r#"{{"type":"{kind}","sessionId":"s1","timestamp":"2026-01-01T00:00:00.500Z"{body}}}"#
        )
    }

    #[test]
    fn an_empty_log_yields_nothing_and_complains_about_nothing() {
        let p = SessionLog::parse("");
        assert!(p.events.is_empty() && p.skipped.is_empty());
    }

    #[test]
    fn blank_lines_are_not_skips() {
        let p = SessionLog::parse("\n\n   \n");
        assert!(p.skipped.is_empty(), "whitespace was reported as a problem");
    }

    #[test]
    fn a_line_without_a_session_is_malformed_rather_than_dropped() {
        let p = SessionLog::parse(r#"{"type":"assistant","timestamp":"2026-01-01T00:00:00Z"}"#);
        assert!(matches!(p.skipped[0].reason, SkipReason::Malformed(_)));
    }

    #[test]
    fn the_timestamp_becomes_milliseconds() {
        let raw = line(
            "assistant",
            r#","message":{"content":[{"type":"text","text":"hi"}]}"#,
        );
        let p = SessionLog::parse(&raw);
        assert_eq!(p.events[0].at().as_millis() % 1000, 500);
    }

    #[test]
    fn a_human_turn_spells_its_content_as_a_bare_string() {
        let raw = line("user", r#","message":{"content":"do the thing"}"#);
        let p = SessionLog::parse(&raw);
        assert!(matches!(
            &p.events[0],
            Event::Text { role: Role::User, content, .. } if content == "do the thing"
        ));
    }

    #[test]
    fn the_harness_annotating_its_own_transcript_is_not_a_person_speaking() {
        // `isMeta` carries an image's dimensions, or a note about a local
        // command. Read as speech it becomes a turn boundary, and a boundary
        // at every screenshot is no boundary at all.
        let raw = r#"{"type":"user","isMeta":true,"sessionId":"s1","timestamp":"2026-01-01T00:00:00Z","message":{"content":"[Image: 2200x1240]"}}"#;
        let p = SessionLog::parse(raw);
        assert!(p.events.is_empty(), "{:?}", p.events);
        assert!(matches!(&p.skipped[0].reason, SkipReason::NotAnEvent(k) if k == "user:isMeta"));
    }

    /// A slash command as the harness writes it, indentation included.
    fn typed(name: &str, args: &str) -> String {
        line(
            "user",
            &format!(
                r#","message":{{"content":"<command-name>{name}</command-name>\n            <command-message>{}</command-message>\n            <command-args>{args}</command-args>"}}"#,
                name.trim_start_matches('/')
            ),
        )
    }

    fn spoke(p: &Parsed) -> Vec<&str> {
        p.events
            .iter()
            .filter_map(|e| match e {
                Event::Text {
                    role: Role::User,
                    content,
                    ..
                } => Some(content.as_str()),
                _ => None,
            })
            .collect()
    }

    #[test]
    fn a_slash_command_reads_as_the_command_and_not_as_its_markup() {
        // The bug, at the level it was reported: after `/clear`, the card
        // headed "What you asked for" showed three tags.
        let p = SessionLog::parse(&typed("/clear", ""));
        assert_eq!(spoke(&p), vec!["/clear"]);
    }

    #[test]
    fn a_command_keeps_the_arguments_it_was_given() {
        let p = SessionLog::parse(&typed("/code-review", "high"));
        assert_eq!(spoke(&p), vec!["/code-review high"]);
    }

    #[test]
    fn what_a_local_command_printed_is_not_somebody_speaking() {
        // `/login` prints `Login successful`, and that reported as the last
        // thing you said is a sentence you never wrote. The whole exchange,
        // so what survives is visible beside what does not.
        let raw = [
            typed("/login", ""),
            line(
                "user",
                r#","message":{"content":"<local-command-stdout>Login successful</local-command-stdout>"}"#,
            ),
            line(
                "assistant",
                r#","message":{"content":[{"type":"text","text":"Logged in."}]}"#,
            ),
        ]
        .join("\n");
        let p = SessionLog::parse(&raw);
        assert_eq!(spoke(&p), vec!["/login"]);
        assert!(
            p.skipped.iter().any(
                |s| matches!(&s.reason, SkipReason::NotAnEvent(k) if k == "user:local-command")
            )
        );
    }

    #[test]
    fn the_caveat_the_harness_attaches_to_a_command_is_not_speech_either() {
        let raw = line(
            "user",
            r#","message":{"content":"<local-command-caveat>Caveat: the messages below…</local-command-caveat>"}"#,
        );
        assert!(SessionLog::parse(&raw).events.is_empty());
    }

    #[test]
    fn somebody_quoting_the_markup_is_still_somebody_speaking() {
        // How this bug was reported: the tags pasted into a sentence. Read
        // anywhere in the turn rather than at the start of it, the parser
        // would have eaten the report.
        let raw = line(
            "user",
            r#","message":{"content":"it broke: <command-name>/clear</command-name> came out raw"}"#,
        );
        let p = SessionLog::parse(&raw);
        assert_eq!(
            spoke(&p),
            vec!["it broke: <command-name>/clear</command-name> came out raw"]
        );
    }

    #[test]
    fn a_command_line_cut_in_half_stays_the_text_it_is() {
        // A log truncated mid-write. Guessing a name out of an unclosed tag
        // would put half a tag on the screen as if it were a command.
        let raw = line("user", r#","message":{"content":"<command-name>/cle"}"#);
        assert_eq!(spoke(&SessionLog::parse(&raw)), vec!["<command-name>/cle"]);
    }

    #[test]
    fn a_known_line_carrying_no_event_is_a_named_skip_not_an_unknown_one() {
        let p = SessionLog::parse(&line("ai-title", ""));
        assert!(matches!(&p.skipped[0].reason, SkipReason::NotAnEvent(k) if k == "ai-title"));
        assert!(p.unknown_types().is_empty());
    }

    #[test]
    fn a_tool_use_that_is_not_a_question_stays_a_tool_call() {
        let raw = line(
            "assistant",
            r#","message":{"content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls"}}]}"#,
        );
        let p = SessionLog::parse(&raw);
        assert!(matches!(&p.events[0], Event::ToolCall { name, .. } if name == "Bash"));
    }

    #[test]
    fn a_question_with_no_options_is_still_a_question() {
        let raw = line(
            "assistant",
            r#","message":{"content":[{"type":"text","text":"asking"},{"type":"tool_use","id":"t1","name":"AskUserQuestion","input":{"questions":[{"header":"H","question":"Q"}]}}]}"#,
        );
        let p = SessionLog::parse(&raw);
        // `find_map(...).expect(...)` rather than a `let … else { panic! }`:
        // the failure arm then lives in `Option::expect` instead of in this
        // file, where it would be a line no passing test ever reaches.
        let question = p
            .events
            .iter()
            .find_map(|e| match e {
                Event::Asked { question, .. } => Some(question),
                _ => None,
            })
            .expect("an Asked event");
        assert_eq!(question.header, "H");
        assert!(question.options.is_empty());
    }

    #[test]
    fn an_ask_without_a_questions_array_degrades_to_a_tool_call() {
        // Rather than dropping it: the call happened, and a shape we do
        // not recognise should still be visible as the tool it was.
        let raw = line(
            "assistant",
            r#","message":{"content":[{"type":"tool_use","id":"t1","name":"AskUserQuestion","input":{}}]}"#,
        );
        let p = SessionLog::parse(&raw);
        assert!(matches!(&p.events[0], Event::ToolCall { name, .. } if name == "AskUserQuestion"));
    }

    #[test]
    fn usage_is_emitted_per_assistant_message() {
        let raw = line(
            "assistant",
            r#","message":{"content":[],"usage":{"input_tokens":3,"output_tokens":9}}"#,
        );
        let p = SessionLog::parse(&raw);
        assert!(matches!(
            p.events[0],
            Event::Usage {
                input_tokens: 3,
                output_tokens: 9,
                ..
            }
        ));
    }
    #[test]
    fn a_line_with_no_type_is_skipped_and_named() {
        // Skipped rather than dropped: a log the parser did not understand
        // is a gap in the queue, and a gap nobody counts is a gap nobody
        // notices.
        let p = SessionLog::parse(r#"{"sessionId":"s","timestamp":"2026-01-01T00:00:00Z"}"#);
        assert!(p.events.is_empty());
        assert_eq!(p.skipped.len(), 1);
    }

    #[test]
    fn a_content_block_of_an_unknown_kind_is_passed_over() {
        // An image, or whatever the harness adds next. The turn still
        // happened and its other blocks still count.
        let raw = line(
            "assistant",
            r#","message":{"content":[{"type":"image","source":{}},{"type":"text","text":"here"}]}"#,
        );
        let p = SessionLog::parse(&raw);
        assert_eq!(p.events.len(), 1);
        assert!(matches!(&p.events[0], Event::Text { .. }));
    }

    #[test]
    fn a_user_line_with_no_content_yields_nothing_rather_than_failing() {
        let p = SessionLog::parse(&line("user", ""));
        assert!(p.events.is_empty());
    }
    #[test]
    fn an_assistant_line_with_no_content_yields_nothing() {
        // The harness writes these on a turn that only carried usage.
        assert!(SessionLog::parse(&line("assistant", "")).events.is_empty());
    }

    #[test]
    fn a_user_block_that_is_not_a_tool_result_is_passed_over() {
        // A user turn carries the answers to tool calls *and* whatever else
        // the harness put there; only the results are facts about a session.
        let raw = line(
            "user",
            r#","message":{"content":[{"type":"text","text":"hello"}]}"#,
        );
        let p = SessionLog::parse(&raw);
        assert!(
            !p.events
                .iter()
                .any(|e| matches!(e, Event::ToolResult { .. }))
        );
    }
}

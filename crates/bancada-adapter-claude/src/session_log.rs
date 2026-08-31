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
            "user" => user(v, &session, at, out),
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

fn user(v: &Value, session: &SessionId, at: Timestamp, out: &mut Parsed) {
    let Some(content) = v.get("message").and_then(|m| m.get("content")) else {
        return;
    };

    // A human turn spells content as a bare string.
    if let Some(s) = content.as_str() {
        out.events.push(Event::Text {
            session: session.clone(),
            at,
            role: Role::User,
            content: s.to_owned(),
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
            r#","message":{"content":[{"type":"tool_use","id":"t1","name":"AskUserQuestion","input":{"questions":[{"header":"H","question":"Q"}]}}]}"#,
        );
        let p = SessionLog::parse(&raw);
        let Event::Asked { question, .. } = &p.events[0] else {
            panic!("expected Asked, got {:?}", p.events[0]);
        };
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
}

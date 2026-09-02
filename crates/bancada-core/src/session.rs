use bancada_adapter_claude::SessionLog;
use bancada_events::{Event, Question, Role};
use bancada_meta::Timestamp;
use serde::Serialize;

/// One session, as the last exchange in it.
///
/// The screen this feeds answers four things about a project: which sessions
/// there are, what each was asked to do, what it last said, and whether the
/// last thing it said was a question. Everything here is the *end* of the
/// log, deliberately — the middle is what the diff is for.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    /// The first thing the human said, which is what the session is about.
    pub title: Option<String>,
    /// The question it is stopped on, already structured. `None` unless the
    /// last thing it did was ask.
    pub asked: Option<Question>,
    /// The last thing it said in prose.
    pub said: Option<String>,
    /// The last thing *you* said to it, so the exchange reads as one.
    pub heard: Option<String>,
    /// When anything last happened, in milliseconds.
    pub at: Timestamp,
}

impl Session {
    pub fn of(id: &str, log: &str) -> Self {
        let events = SessionLog::parse(log).events;

        Session {
            id: id.to_owned(),
            title: crate::Glance::of(log).title,
            asked: pending(&events),
            said: last_text(&events, Role::Assistant),
            heard: last_text(&events, Role::User),
            at: events
                .last()
                .map(Event::at)
                .unwrap_or_else(|| Timestamp::from_millis(0)),
        }
    }
}

/// The question a session is stopped on, if it is stopped on one.
///
/// Only when nothing has happened since. An answered question is history,
/// and drawing it as a live set of choices would offer a decision that has
/// already been made — which is worse than showing nothing, because it looks
/// exactly like one that has not.
fn pending(events: &[Event]) -> Option<Question> {
    match events.last() {
        Some(Event::Asked { question, .. }) => Some(question.clone()),
        _ => None,
    }
}

fn last_text(events: &[Event], who: Role) -> Option<String> {
    events.iter().rev().find_map(|e| match e {
        Event::Text { role, content, .. } if *role == who && !content.trim().is_empty() => {
            Some(content.clone())
        }
        _ => None,
    })
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
    fn asked() -> String {
        r#"{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:03Z","message":{"content":[{"type":"tool_use","id":"q","name":"AskUserQuestion","input":{"questions":[{"question":"Which way?","header":"Route","options":[{"label":"Left","description":"west"},{"label":"Right","description":"east"}]}]}}]}}"#.to_owned()
    }
    fn log(lines: &[&str]) -> String {
        lines.join("\n")
    }

    #[test]
    fn a_session_is_the_last_thing_each_side_said() {
        let s = Session::of(
            "abc",
            &log(&[
                &user("do the first thing"),
                &assistant("done"),
                &user("now the second"),
                &assistant("also done"),
            ]),
        );
        assert_eq!(s.id, "abc");
        assert_eq!(s.heard.as_deref(), Some("now the second"));
        assert_eq!(s.said.as_deref(), Some("also done"));
    }

    #[test]
    fn the_title_is_the_first_thing_asked_for_not_the_last() {
        // Later turns are "continue" and "yes", and a title that changes
        // every time you answer is not a title.
        let s = Session::of("abc", &log(&[&user("build the thing"), &user("continue")]));
        assert_eq!(s.title.as_deref(), Some("build the thing"));
    }

    #[test]
    fn a_question_it_is_stopped_on_comes_through_whole() {
        let s = Session::of("abc", &log(&[&user("go"), &asked()]));
        let q = s.asked.expect("a question");
        assert_eq!(q.prompt, "Which way?");
        assert_eq!(q.options.len(), 2);
        assert_eq!(q.options[0].label, "Left");
    }

    #[test]
    fn a_question_already_answered_is_not_offered_again() {
        // History. Drawn as a live set of choices it would offer a decision
        // that has been made, and look exactly like one that has not.
        let s = Session::of("abc", &log(&[&asked(), &user("Left"), &assistant("going")]));
        assert!(s.asked.is_none());
        assert_eq!(s.heard.as_deref(), Some("Left"));
    }

    #[test]
    fn a_session_that_only_listened_has_nothing_to_say() {
        let s = Session::of("abc", &log(&[&user("hello")]));
        assert!(s.said.is_none());
        assert!(s.asked.is_none());
        assert_eq!(s.heard.as_deref(), Some("hello"));
    }

    #[test]
    fn blank_prose_is_not_the_last_thing_said() {
        // The harness writes an empty text block beside a tool call. Taken
        // as speech, every working session reports having said nothing.
        let s = Session::of(
            "abc",
            &log(&[&assistant("the real answer"), &assistant("   ")]),
        );
        assert_eq!(s.said.as_deref(), Some("the real answer"));
    }

    #[test]
    fn the_time_is_the_last_thing_that_happened() {
        let s = Session::of("abc", &log(&[&user("go"), &asked()]));
        assert_eq!(s.at.as_millis(), 1_767_225_603_000);
    }

    #[test]
    fn an_empty_log_is_a_session_with_nothing_in_it() {
        let s = Session::of("abc", "");
        assert_eq!(s.at.as_millis(), 0);
        assert!(s.title.is_none() && s.said.is_none() && s.heard.is_none());
    }
}

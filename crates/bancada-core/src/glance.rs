use bancada_adapter_claude::SessionLog;
use bancada_events::{Event, Role};
use serde::Serialize;
use std::collections::BTreeMap;

/// What a queue row is *about*, in words.
///
/// The queue is ranked from metadata alone — hard rule 2, and the reason
/// hallucination can never reach the order of your attention. But a row that
/// says `Review` beside a uuid makes you open it to find out whether it
/// matters, and triage you cannot do without opening is not triage.
///
/// So this is content, read **here**, after the ranking is already decided,
/// and merged in at the edge. Nothing in `bancada-rules` ever sees a word of
/// it. The engine says which row is first; this says what the row is.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Glance {
    /// The first thing the human said, which is what the session is about.
    ///
    /// The first, not the last: later turns are "continue" and "yes", and a
    /// title that changes every time you answer is not a title.
    pub title: Option<String>,
    /// What each raised decision actually is, by the tool-use id that
    /// raised it — the same id the queue item carries.
    pub says: BTreeMap<String, String>,
    /// Files this session wrote. What a `Review` row is worth saying.
    pub touched: usize,
    /// Of those, how many no announcement named.
    pub unannounced: usize,
}

/// How much of a first message is worth carrying to a queue row.
const TITLE: usize = 96;

impl Glance {
    pub fn of(log: &str) -> Self {
        let parsed = SessionLog::parse(log);
        let review = crate::Review::of(log);

        Glance {
            title: first_human_words(&parsed.events).map(|t| clip(&t, TITLE)),
            says: parsed
                .events
                .iter()
                .filter_map(describe)
                .collect::<BTreeMap<_, _>>(),
            touched: review.touched.len(),
            unannounced: review.unannounced.len(),
        }
    }
}

/// What one decision is asking, keyed by the id that raised it.
fn describe(e: &Event) -> Option<(String, String)> {
    match e {
        Event::Asked { id, question, .. } => {
            let said = if question.prompt.trim().is_empty() {
                question.header.clone()
            } else {
                question.prompt.clone()
            };
            (!said.trim().is_empty()).then(|| (id.clone(), clip(&said, TITLE)))
        }
        _ => None,
    }
}

/// The human's opening line, with the harness's own preamble skipped.
///
/// A resumed session begins with a block the harness wrote, not the person,
/// and a queue row titled with a system reminder is worse than one titled
/// with nothing.
fn first_human_words(events: &[Event]) -> Option<String> {
    events.iter().find_map(|e| match e {
        Event::Text {
            role: Role::User,
            content,
            ..
        } => {
            let said = strip_reminders(content);
            (!said.is_empty()).then_some(said)
        }
        _ => None,
    })
}

fn strip_reminders(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("<system-reminder>") {
        out.push_str(&rest[..start]);
        match rest[start..].find("</system-reminder>") {
            Some(end) => rest = &rest[start + end + "</system-reminder>".len()..],
            // Unclosed: everything after it is the harness's, not the human's.
            None => return out.trim().to_owned(),
        }
    }
    out.push_str(rest);
    out.trim().to_owned()
}

/// One line's worth, cut on a word and marked as cut.
fn clip(text: &str, max: usize) -> String {
    let line = text
        .lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("")
        .trim();
    if line.chars().count() <= max {
        return line.to_owned();
    }
    let head: String = line.chars().take(max).collect();
    let cut = head.rfind(' ').unwrap_or(head.len());
    format!("{}…", head[..cut].trim_end())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn human(text: &str) -> String {
        format!(
            r#"{{"type":"user","sessionId":"s","timestamp":"2026-01-01T00:00:00Z","message":{{"content":{}}}}}"#,
            serde_json::to_string(text).unwrap()
        )
    }
    fn asked(id: &str, header: &str, question: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s","timestamp":"2026-01-01T00:00:01Z","message":{{"content":[{{"type":"tool_use","id":"{id}","name":"AskUserQuestion","input":{{"questions":[{{"header":"{header}","question":"{question}"}}]}}}}]}}}}"#
        )
    }

    #[test]
    fn the_title_is_what_you_asked_for_first() {
        let g = Glance::of(&[human("Add a folder picker"), human("continue")].join("\n"));
        // The first, not the last: later turns are "continue" and "yes", and
        // a title that changes when you answer is not a title.
        assert_eq!(g.title.as_deref(), Some("Add a folder picker"));
    }

    #[test]
    fn a_harness_preamble_is_not_something_you_said() {
        let g = Glance::of(&human(
            "<system-reminder>resumed from a summary</system-reminder>\nFix the parser",
        ));
        assert_eq!(g.title.as_deref(), Some("Fix the parser"));
    }

    #[test]
    fn a_turn_that_is_only_a_reminder_yields_no_title() {
        // Better nothing than a queue row titled with plumbing.
        let g = Glance::of(&human("<system-reminder>context</system-reminder>"));
        assert!(g.title.is_none());
    }

    #[test]
    fn a_long_first_line_is_cut_on_a_word_and_says_so() {
        let long = "Rewrite the settings screen so registering a project \
                    starts from a folder picker instead of six fields";
        let title = Glance::of(&human(long)).title.unwrap();

        assert!(title.ends_with('…'), "a cut line has to say it was cut");
        assert!(title.chars().count() <= TITLE + 1);

        // Cut on a word: the kept part must be a prefix of the original that
        // ends exactly where a space does. A title ending mid-word reads as
        // a rendering bug rather than as an abbreviation.
        let kept = title.trim_end_matches('…');
        assert!(long.starts_with(kept), "not a prefix: {kept}");
        assert_eq!(
            long[kept.len()..].chars().next(),
            Some(' '),
            "cut mid-word: {title}"
        );
    }

    #[test]
    fn a_question_is_carried_under_the_id_that_raised_it() {
        let g = Glance::of(&[human("hi"), asked("t1", "Icons", "Which icon set?")].join("\n"));
        assert_eq!(
            g.says.get("t1").map(String::as_str),
            Some("Which icon set?")
        );
    }

    #[test]
    fn a_question_with_no_text_falls_back_to_its_header() {
        let g = Glance::of(&[human("hi"), asked("t1", "Icons", "")].join("\n"));
        assert_eq!(g.says.get("t1").map(String::as_str), Some("Icons"));
    }

    #[test]
    fn an_empty_log_glances_at_nothing_rather_than_failing() {
        assert_eq!(Glance::of(""), Glance::default());
    }
}

use crate::Question;
use bancada_meta::{DecisionKind, MetaEvent, SessionId, Timestamp};

/// One thing a session log records.
///
/// Every variant corresponds to something a line in the log actually
/// carries. Turn boundaries are **not** here: no line says a turn began or
/// ended, so they are derived above the adapter rather than invented
/// inside it. See `docs/specs/0002-session-log-parser.md`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    Text {
        session: SessionId,
        at: Timestamp,
        role: Role,
        content: String,
    },
    Thinking {
        session: SessionId,
        at: Timestamp,
        content: String,
    },
    ToolCall {
        session: SessionId,
        at: Timestamp,
        id: String,
        name: String,
        input: String,
    },
    ToolResult {
        session: SessionId,
        at: Timestamp,
        id: String,
        ok: bool,
        output: String,
    },
    Asked {
        session: SessionId,
        at: Timestamp,
        id: String,
        question: Question,
    },
    /// Token counts, as the log records them: per assistant message, not
    /// per turn. Summing into a turn is derivation.
    Usage {
        session: SessionId,
        at: Timestamp,
        input_tokens: u64,
        output_tokens: u64,
        cache_read_tokens: u64,
        cache_creation_tokens: u64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    User,
    Assistant,
}

impl Event {
    pub fn session(&self) -> &SessionId {
        match self {
            Self::Text { session, .. }
            | Self::Thinking { session, .. }
            | Self::ToolCall { session, .. }
            | Self::ToolResult { session, .. }
            | Self::Asked { session, .. }
            | Self::Usage { session, .. } => session,
        }
    }

    pub fn at(&self) -> Timestamp {
        match self {
            Self::Text { at, .. }
            | Self::Thinking { at, .. }
            | Self::ToolCall { at, .. }
            | Self::ToolResult { at, .. }
            | Self::Asked { at, .. }
            | Self::Usage { at, .. } => *at,
        }
    }

    /// Project onto what the rules engine may see.
    ///
    /// `None` where nothing survives: prose and reasoning are entirely
    /// content, and an event that reduces to nothing should not reach the
    /// engine as an empty shell it has to skip.
    pub fn to_meta(&self) -> Option<MetaEvent> {
        Some(match self {
            Self::Text { .. } | Self::Thinking { .. } => return None,
            Self::ToolCall {
                session, at, name, ..
            } => MetaEvent::ToolCalled {
                session: session.clone(),
                at: *at,
                tool: name.clone(),
            },
            // A result's output is content. What survives is whether the
            // call failed, which is what stagnation detection counts.
            Self::ToolResult {
                session, at, ok, ..
            } => MetaEvent::Errored {
                session: session.clone(),
                at: *at,
                fatal: false,
            }
            .only_if(!ok)?,
            Self::Asked { session, at, .. } => MetaEvent::DecisionRaised {
                session: session.clone(),
                at: *at,
                kind: DecisionKind::Question,
            },
            Self::Usage {
                session,
                at,
                input_tokens,
                output_tokens,
                ..
            } => MetaEvent::TurnEnded {
                session: session.clone(),
                at: *at,
                input_tokens: *input_tokens,
                output_tokens: *output_tokens,
            },
        })
    }
}

trait OnlyIf: Sized {
    fn only_if(self, cond: bool) -> Option<Self>;
}

impl OnlyIf for MetaEvent {
    fn only_if(self, cond: bool) -> Option<Self> {
        cond.then_some(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(ms: i64) -> Timestamp {
        Timestamp::from_millis(ms)
    }

    fn s() -> SessionId {
        SessionId::new("s")
    }

    #[test]
    fn prose_does_not_survive_the_projection() {
        let e = Event::Text {
            session: s(),
            at: at(0),
            role: Role::Assistant,
            content: "the client's schema is wrong".into(),
        };
        assert!(e.to_meta().is_none(), "content reached the engine");
    }

    #[test]
    fn reasoning_does_not_survive_either() {
        let e = Event::Thinking {
            session: s(),
            at: at(0),
            content: "their auth token looks like…".into(),
        };
        assert!(e.to_meta().is_none());
    }

    #[test]
    fn a_tool_call_keeps_its_name_and_drops_its_input() {
        let e = Event::ToolCall {
            session: s(),
            at: at(10),
            id: "t1".into(),
            name: "Bash".into(),
            input: "psql -c 'select * from clients'".into(),
        };
        let Some(MetaEvent::ToolCalled { tool, .. }) = e.to_meta() else {
            panic!("expected ToolCalled");
        };
        assert_eq!(tool, "Bash");
    }

    #[test]
    fn a_successful_result_carries_nothing_the_engine_needs() {
        let e = Event::ToolResult {
            session: s(),
            at: at(10),
            id: "t1".into(),
            ok: true,
            output: "rows: 400".into(),
        };
        assert!(e.to_meta().is_none());
    }

    #[test]
    fn a_failed_result_survives_as_a_non_fatal_error() {
        let e = Event::ToolResult {
            session: s(),
            at: at(10),
            id: "t1".into(),
            ok: false,
            output: "/mnt/dev/ClientApp/src/db.rs:42: boom".into(),
        };
        assert!(matches!(
            e.to_meta(),
            Some(MetaEvent::Errored { fatal: false, .. })
        ));
    }

    #[test]
    fn a_question_becomes_a_decision_without_its_options() {
        let e = Event::Asked {
            session: s(),
            at: at(10),
            id: "t1".into(),
            question: Question {
                header: "Route".into(),
                prompt: "Which way?".into(),
                multi: false,
                options: vec![],
            },
        };
        assert!(matches!(
            e.to_meta(),
            Some(MetaEvent::DecisionRaised {
                kind: DecisionKind::Question,
                ..
            })
        ));
    }

    #[test]
    fn usage_carries_the_counts_through() {
        let e = Event::Usage {
            session: s(),
            at: at(10),
            input_tokens: 7,
            output_tokens: 11,
            cache_read_tokens: 900,
            cache_creation_tokens: 3,
        };
        let Some(MetaEvent::TurnEnded {
            input_tokens,
            output_tokens,
            ..
        }) = e.to_meta()
        else {
            panic!("expected TurnEnded");
        };
        assert_eq!((input_tokens, output_tokens), (7, 11));
    }
}

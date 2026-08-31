use crate::Question;
use bancada_meta::{DecisionKind, MetaEvent, SessionId, Timestamp};
use std::path::PathBuf;

/// One thing that happened in a session, content included.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    TurnStarted {
        session: SessionId,
        at: Timestamp,
    },
    Text {
        session: SessionId,
        at: Timestamp,
        role: Role,
        content: String,
    },
    ToolCall {
        session: SessionId,
        at: Timestamp,
        tool: String,
        input: String,
    },
    FileChanged {
        session: SessionId,
        at: Timestamp,
        path: PathBuf,
    },
    Asked {
        session: SessionId,
        at: Timestamp,
        question: Question,
    },
    PermissionAsked {
        session: SessionId,
        at: Timestamp,
        tool: String,
    },
    TurnEnded {
        session: SessionId,
        at: Timestamp,
        input_tokens: u64,
        output_tokens: u64,
    },
    Failed {
        session: SessionId,
        at: Timestamp,
        message: String,
        fatal: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    User,
    Assistant,
}

impl Event {
    /// Project onto what the rules engine may see.
    ///
    /// `None` where nothing survives the projection: a line of prose is
    /// entirely content, and an event that reduces to nothing should not
    /// reach the engine as an empty shell it has to skip.
    pub fn to_meta(&self) -> Option<MetaEvent> {
        Some(match self {
            Self::TurnStarted { session, at } => MetaEvent::TurnStarted {
                session: session.clone(),
                at: *at,
            },
            Self::Text { .. } => return None,
            Self::ToolCall {
                session, at, tool, ..
            } => MetaEvent::ToolCalled {
                session: session.clone(),
                at: *at,
                tool: tool.clone(),
            },
            Self::FileChanged { session, at, path } => MetaEvent::FileTouched {
                session: session.clone(),
                at: *at,
                path: path.clone(),
            },
            Self::Asked { session, at, .. } => MetaEvent::DecisionRaised {
                session: session.clone(),
                at: *at,
                kind: DecisionKind::Question,
            },
            Self::PermissionAsked { session, at, .. } => MetaEvent::DecisionRaised {
                session: session.clone(),
                at: *at,
                kind: DecisionKind::Permission,
            },
            Self::TurnEnded {
                session,
                at,
                input_tokens,
                output_tokens,
            } => MetaEvent::TurnEnded {
                session: session.clone(),
                at: *at,
                input_tokens: *input_tokens,
                output_tokens: *output_tokens,
            },
            Self::Failed {
                session, at, fatal, ..
            } => MetaEvent::Errored {
                session: session.clone(),
                at: *at,
                fatal: *fatal,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(ms: i64) -> Timestamp {
        Timestamp::from_millis(ms)
    }

    #[test]
    fn prose_does_not_survive_the_projection() {
        let e = Event::Text {
            session: SessionId::new("s"),
            at: at(0),
            role: Role::Assistant,
            content: "the client's schema is wrong".into(),
        };
        assert!(e.to_meta().is_none(), "content reached the engine");
    }

    #[test]
    fn a_tool_call_keeps_its_name_and_drops_its_input() {
        let e = Event::ToolCall {
            session: SessionId::new("s"),
            at: at(10),
            tool: "Bash".into(),
            input: "psql -c 'select * from clients'".into(),
        };
        let Some(MetaEvent::ToolCalled { tool, .. }) = e.to_meta() else {
            panic!("expected ToolCalled");
        };
        assert_eq!(tool, "Bash");
    }

    #[test]
    fn a_question_becomes_a_decision_without_its_options() {
        let e = Event::Asked {
            session: SessionId::new("s"),
            at: at(10),
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
    fn a_failure_keeps_only_whether_it_was_fatal() {
        let e = Event::Failed {
            session: SessionId::new("s"),
            at: at(10),
            message: "/mnt/dev/ClientApp/src/db.rs:42".into(),
            fatal: true,
        };
        assert!(matches!(
            e.to_meta(),
            Some(MetaEvent::Errored { fatal: true, .. })
        ));
    }
}

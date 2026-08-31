use crate::{DecisionKind, SessionId, Timestamp};
use std::path::PathBuf;

/// What the rules engine is allowed to know about a session.
///
/// Every variant is a fact *about* the work: when, which tool, which path,
/// how many tokens. None of them can carry what was said. That is hard
/// rule 2, expressed as a type rather than as a convention.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MetaEvent {
    TurnStarted {
        session: SessionId,
        at: Timestamp,
    },
    ToolCalled {
        session: SessionId,
        at: Timestamp,
        /// The tool's name, never its input.
        tool: String,
    },
    FileTouched {
        session: SessionId,
        at: Timestamp,
        /// The path, never the contents.
        path: PathBuf,
    },
    DecisionRaised {
        session: SessionId,
        at: Timestamp,
        kind: DecisionKind,
    },
    TurnEnded {
        session: SessionId,
        at: Timestamp,
        input_tokens: u64,
        output_tokens: u64,
    },
    Errored {
        session: SessionId,
        at: Timestamp,
        fatal: bool,
    },
}

impl MetaEvent {
    pub fn session(&self) -> &SessionId {
        match self {
            Self::TurnStarted { session, .. }
            | Self::ToolCalled { session, .. }
            | Self::FileTouched { session, .. }
            | Self::DecisionRaised { session, .. }
            | Self::TurnEnded { session, .. }
            | Self::Errored { session, .. } => session,
        }
    }

    pub fn at(&self) -> Timestamp {
        match self {
            Self::TurnStarted { at, .. }
            | Self::ToolCalled { at, .. }
            | Self::FileTouched { at, .. }
            | Self::DecisionRaised { at, .. }
            | Self::TurnEnded { at, .. }
            | Self::Errored { at, .. } => *at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(ms: i64) -> Timestamp {
        Timestamp::from_millis(ms)
    }

    #[test]
    fn every_variant_answers_which_session_it_belongs_to() {
        let s = SessionId::new("s1");
        let all = [
            MetaEvent::TurnStarted {
                session: s.clone(),
                at: at(0),
            },
            MetaEvent::ToolCalled {
                session: s.clone(),
                at: at(0),
                tool: "Bash".into(),
            },
            MetaEvent::FileTouched {
                session: s.clone(),
                at: at(0),
                path: "a.rs".into(),
            },
            MetaEvent::DecisionRaised {
                session: s.clone(),
                at: at(0),
                kind: DecisionKind::Question,
            },
            MetaEvent::TurnEnded {
                session: s.clone(),
                at: at(0),
                input_tokens: 1,
                output_tokens: 2,
            },
            MetaEvent::Errored {
                session: s.clone(),
                at: at(0),
                fatal: true,
            },
        ];
        for e in &all {
            assert_eq!(e.session(), &s, "{e:?} lost its session");
        }
    }

    #[test]
    fn every_variant_answers_when_it_happened() {
        let s = SessionId::new("s1");
        let e = MetaEvent::DecisionRaised {
            session: s,
            at: at(4_200),
            kind: DecisionKind::Review,
        };
        assert_eq!(e.at(), at(4_200));
    }
}

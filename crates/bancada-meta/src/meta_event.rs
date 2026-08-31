use crate::{DecisionKind, SessionId, Timestamp};
use std::path::PathBuf;

/// What the rules engine is allowed to know about a session.
///
/// Every variant is a line the log carries, reduced to the fact in it.
/// None can hold what was said — hard rule 2 as a type rather than as a
/// convention.
///
/// Note what is *not* here: turn boundaries. No line records one. They are
/// derived from `HumanSpoke`, which is possible only because "a human
/// spoke" is a fact separate from what they said.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MetaEvent {
    /// A human turn happened. The turn opener.
    HumanSpoke { session: SessionId, at: Timestamp },
    /// The agent produced prose. Usually a turn's last breath.
    AgentSpoke { session: SessionId, at: Timestamp },
    ToolCalled {
        session: SessionId,
        at: Timestamp,
        /// Opaque call id, so a completion can be matched to its call.
        id: String,
        /// The tool's name, never its input.
        tool: String,
    },
    /// A call finished. `ok` is the *tool* succeeding, not the command —
    /// a shell exiting non-zero is a successful call. See docs/RISKS.md.
    ToolCompleted {
        session: SessionId,
        at: Timestamp,
        id: String,
        ok: bool,
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
        /// The call id that raised it. A decision is pending until a
        /// completion carrying this id arrives — the only way resolution
        /// is visible without reading content.
        id: String,
        kind: DecisionKind,
    },
    /// Counts as the log records them: per message, not per turn.
    Tokens {
        session: SessionId,
        at: Timestamp,
        input: u64,
        output: u64,
        cache_read: u64,
        cache_creation: u64,
    },
}

impl MetaEvent {
    pub fn session(&self) -> &SessionId {
        match self {
            Self::HumanSpoke { session, .. }
            | Self::AgentSpoke { session, .. }
            | Self::ToolCalled { session, .. }
            | Self::ToolCompleted { session, .. }
            | Self::FileTouched { session, .. }
            | Self::DecisionRaised { session, .. }
            | Self::Tokens { session, .. } => session,
        }
    }

    pub fn at(&self) -> Timestamp {
        match self {
            Self::HumanSpoke { at, .. }
            | Self::AgentSpoke { at, .. }
            | Self::ToolCalled { at, .. }
            | Self::ToolCompleted { at, .. }
            | Self::FileTouched { at, .. }
            | Self::DecisionRaised { at, .. }
            | Self::Tokens { at, .. } => *at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(ms: i64) -> Timestamp {
        Timestamp::from_millis(ms)
    }

    fn all(s: &SessionId) -> Vec<MetaEvent> {
        vec![
            MetaEvent::HumanSpoke {
                session: s.clone(),
                at: at(1),
            },
            MetaEvent::AgentSpoke {
                session: s.clone(),
                at: at(1),
            },
            MetaEvent::ToolCalled {
                session: s.clone(),
                at: at(1),
                id: "t1".into(),
                tool: "Bash".into(),
            },
            MetaEvent::ToolCompleted {
                session: s.clone(),
                at: at(1),
                id: "t1".into(),
                ok: true,
            },
            MetaEvent::FileTouched {
                session: s.clone(),
                at: at(1),
                path: "a.rs".into(),
            },
            MetaEvent::DecisionRaised {
                session: s.clone(),
                at: at(1),
                id: "t2".into(),
                kind: DecisionKind::Question,
            },
            MetaEvent::Tokens {
                session: s.clone(),
                at: at(1),
                input: 1,
                output: 2,
                cache_read: 3,
                cache_creation: 4,
            },
        ]
    }

    #[test]
    fn every_variant_answers_which_session_it_belongs_to() {
        let s = SessionId::new("s1");
        for e in all(&s) {
            assert_eq!(e.session(), &s, "{e:?} lost its session");
        }
    }

    #[test]
    fn every_variant_answers_when_it_happened() {
        let s = SessionId::new("s1");
        for e in all(&s) {
            assert_eq!(e.at(), at(1), "{e:?} lost its timestamp");
        }
    }

    #[test]
    fn a_call_and_its_completion_share_an_id() {
        let s = SessionId::new("s1");
        let v = all(&s);
        let called = v.iter().find_map(|e| match e {
            MetaEvent::ToolCalled { id, .. } => Some(id.clone()),
            _ => None,
        });
        let done = v.iter().find_map(|e| match e {
            MetaEvent::ToolCompleted { id, .. } => Some(id.clone()),
            _ => None,
        });
        assert_eq!(
            called, done,
            "matching a completion to its call is the whole point"
        );
    }
}

use crate::Question;
use bancada_meta::{DecisionKind, MetaEvent, SessionId, Timestamp};

/// One thing a session log records.
///
/// Every variant corresponds to something a line actually carries. Turn
/// boundaries are not here: no line records one. They are derived above
/// the adapter rather than invented inside it.
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
    /// Token counts as the log records them: per message, not per turn.
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
    /// `None` where nothing survives. Note what does: *that* someone spoke
    /// is a fact, while *what* they said is content — and keeping the fact
    /// is what makes turn derivation possible without the engine reading a
    /// word.
    pub fn to_meta(&self) -> Option<MetaEvent> {
        let session = self.session().clone();
        let at = self.at();
        Some(match self {
            Self::Text {
                role: Role::User, ..
            } => MetaEvent::HumanSpoke { session, at },
            Self::Text { .. } => MetaEvent::AgentSpoke { session, at },
            Self::Thinking { .. } => return None,
            Self::ToolCall { id, name, .. } => MetaEvent::ToolCalled {
                session,
                at,
                id: id.clone(),
                tool: name.clone(),
            },
            // The output is content. What survives is the id and whether the
            // tool failed — and the id is what makes a decision's resolution
            // visible without reading a word of the answer.
            Self::ToolResult { id, ok, .. } => MetaEvent::ToolCompleted {
                session,
                at,
                id: id.clone(),
                ok: *ok,
            },
            Self::Asked { id, .. } => MetaEvent::DecisionRaised {
                session,
                at,
                id: id.clone(),
                kind: DecisionKind::Question,
            },
            Self::Usage {
                input_tokens,
                output_tokens,
                cache_read_tokens,
                cache_creation_tokens,
                ..
            } => MetaEvent::Tokens {
                session,
                at,
                input: *input_tokens,
                output: *output_tokens,
                cache_read: *cache_read_tokens,
                cache_creation: *cache_creation_tokens,
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

    fn s() -> SessionId {
        SessionId::new("s")
    }

    #[test]
    fn prose_becomes_the_fact_that_someone_spoke_and_nothing_else() {
        let e = Event::Text {
            session: s(),
            at: at(0),
            role: Role::Assistant,
            content: "the client's schema is wrong".into(),
        };
        assert!(matches!(e.to_meta(), Some(MetaEvent::AgentSpoke { .. })));
    }

    #[test]
    fn a_human_turn_is_distinguishable_from_the_agent_speaking() {
        let e = Event::Text {
            session: s(),
            at: at(0),
            role: Role::User,
            content: "do the thing".into(),
        };
        assert!(matches!(e.to_meta(), Some(MetaEvent::HumanSpoke { .. })));
    }

    #[test]
    fn reasoning_does_not_survive_at_all() {
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
        let got = e.to_meta();
        assert!(
            matches!(&got, Some(MetaEvent::ToolCalled { id, tool, .. }) if id == "t1" && tool == "Bash"),
            "expected ToolCalled(t1, Bash), got {got:?}"
        );
    }

    #[test]
    fn a_result_keeps_its_id_and_drops_its_output() {
        let e = Event::ToolResult {
            session: s(),
            at: at(10),
            id: "t1".into(),
            ok: true,
            output: "rows: 400 — client@example.com".into(),
        };
        let got = e.to_meta();
        assert!(
            matches!(&got, Some(MetaEvent::ToolCompleted { id, ok, .. }) if id == "t1" && *ok),
            "expected a successful ToolCompleted(t1), got {got:?}"
        );
    }

    #[test]
    fn a_failed_result_says_so_without_saying_how() {
        let e = Event::ToolResult {
            session: s(),
            at: at(10),
            id: "t1".into(),
            ok: false,
            output: "/mnt/dev/ClientApp/src/db.rs:42: boom".into(),
        };
        assert!(matches!(
            e.to_meta(),
            Some(MetaEvent::ToolCompleted { ok: false, .. })
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
        let got = e.to_meta();
        assert!(
            matches!(&got, Some(MetaEvent::DecisionRaised { id, kind, .. })
                if id == "t1" && *kind == DecisionKind::Question),
            "expected DecisionRaised(t1, Question), got {got:?}"
        );
    }

    #[test]
    fn usage_carries_every_count_through() {
        let e = Event::Usage {
            session: s(),
            at: at(10),
            input_tokens: 7,
            output_tokens: 11,
            cache_read_tokens: 900,
            cache_creation_tokens: 3,
        };
        let got = e.to_meta();
        assert!(
            matches!(&got, Some(MetaEvent::Tokens { input, output, cache_read, cache_creation, .. })
                if *input == 7 && *output == 11 && *cache_read == 900 && *cache_creation == 3),
            "expected Tokens(7, 11, 900, 3), got {got:?}"
        );
    }
}

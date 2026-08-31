use bancada_meta::{DecisionKind, Timestamp};

/// A decision raised and not yet resolved.
///
/// The `id` is what makes resolution visible: a decision stays pending
/// until a completion carrying the same id arrives. No content is read to
/// know that a question was answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pending {
    pub id: String,
    pub kind: DecisionKind,
    pub at: Timestamp,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pending_decision_remembers_when_it_was_raised() {
        let p = Pending {
            id: "t1".into(),
            kind: DecisionKind::Question,
            at: Timestamp::from_millis(500),
        };
        assert_eq!(p.at.as_millis(), 500);
    }
}

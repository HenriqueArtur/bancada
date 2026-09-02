use serde::{Deserialize, Serialize};
/// What a pending decision is, without saying anything about its content.
///
/// The kind is the first factor of the ranking, and it is the reason a
/// permission on a critical project stays below an architecture choice on
/// a dormant one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DecisionKind {
    /// A structured question with options.
    Question,
    /// A plan waiting for approval.
    PlanApproval,
    /// A tool call waiting for permission.
    Permission,
    /// A turn ended with work to look at.
    Review,
    /// Nothing has happened for longer than this project's normal.
    Stalled,
}

impl DecisionKind {
    /// How expensive this kind is to get wrong, as a ranking factor.
    ///
    /// Deliberately coarse. A finer scale would imply a precision the
    /// underlying judgement does not have.
    pub const fn weight(self) -> u32 {
        match self {
            Self::PlanApproval => 4,
            Self::Question => 3,
            Self::Stalled => 2,
            Self::Review => 2,
            Self::Permission => 1,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_permission_never_outweighs_a_question() {
        assert!(DecisionKind::Permission.weight() < DecisionKind::Question.weight());
    }

    #[test]
    fn approving_a_plan_is_the_most_expensive_to_get_wrong() {
        let heaviest = DecisionKind::PlanApproval.weight();
        for k in [
            DecisionKind::Question,
            DecisionKind::Permission,
            DecisionKind::Review,
            DecisionKind::Stalled,
        ] {
            assert!(k.weight() <= heaviest, "{k:?} outweighed PlanApproval");
        }
    }
}

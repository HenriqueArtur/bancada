use bancada_meta::{DecisionKind, SessionId, Timestamp};
use serde::{Deserialize, Serialize};

/// One thing waiting on the human.
///
/// The unit is the decision, not the session: a pending question and a
/// scope escape in the same session are two things, need two actions, and
/// neither may hide behind the other.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueueItem {
    pub session: SessionId,
    pub kind: DecisionKind,
    pub raised_at: Timestamp,
    /// How many other items this one is holding up.
    pub blocking: u32,
    /// How fast waiting hurts on this project. 1 is the baseline.
    pub project_weight: u32,
    /// Which project this came from.
    ///
    /// Carried rather than looked up later: an item that cannot say where it
    /// belongs cannot be opened, and a queue you can only read is half a
    /// cockpit.
    pub project: String,
}

impl QueueItem {
    pub fn new(session: SessionId, kind: DecisionKind, raised_at: Timestamp) -> Self {
        Self {
            session,
            kind,
            raised_at,
            blocking: 0,
            project: String::new(),
            project_weight: 1,
        }
    }

    pub fn with_weight(mut self, weight: u32) -> Self {
        self.project_weight = weight.max(1);
        self
    }

    pub fn in_project(mut self, id: &str) -> Self {
        self.project = id.to_owned();
        self
    }

    pub fn blocking(mut self, n: u32) -> Self {
        self.blocking = n;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_item_starts_at_the_baseline_weight() {
        let i = QueueItem::new(
            SessionId::new("s"),
            DecisionKind::Question,
            Timestamp::from_millis(0),
        );
        assert_eq!(i.project_weight, 1);
        assert_eq!(i.blocking, 0);
    }

    #[test]
    fn a_weight_below_the_baseline_is_raised_to_it() {
        let i = QueueItem::new(
            SessionId::new("s"),
            DecisionKind::Question,
            Timestamp::from_millis(0),
        )
        .with_weight(0);
        assert_eq!(
            i.project_weight, 1,
            "weight 0 would erase the item from the order"
        );
    }
}

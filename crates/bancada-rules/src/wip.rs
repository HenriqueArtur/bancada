use crate::Grouped;

/// How much of the human's attention is already spoken for.
///
/// The ceiling is **sessions waiting**, not items and not sessions
/// running. Six agents working cost no attention; five stalled on you mean
/// you became the bottleneck. Unweighted on purpose: attention is finite
/// regardless of whose work it is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Wip {
    pub sessions_waiting: usize,
    pub items: usize,
    pub limit: usize,
}

impl Wip {
    /// Research puts the useful range at two to four parallel agents, with
    /// diminishing returns past five. A default rather than a guess.
    pub const DEFAULT_LIMIT: usize = 4;

    pub fn of(groups: &[Grouped], limit: usize) -> Self {
        Self {
            sessions_waiting: groups.len(),
            items: groups.iter().map(|g| g.items.len()).sum(),
            limit,
        }
    }

    pub const fn over(&self) -> bool {
        self.sessions_waiting > self.limit
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{QueueItem, group, rank};
    use bancada_meta::{DecisionKind, SessionId, Timestamp};

    const NOW: Timestamp = Timestamp::from_millis(1_000_000);

    fn groups(sessions: &[&str], per: usize) -> Vec<Grouped> {
        let items: Vec<QueueItem> = sessions
            .iter()
            .flat_map(|s| {
                (0..per).map(move |_| {
                    QueueItem::new(
                        SessionId::new(*s),
                        DecisionKind::Permission,
                        Timestamp::from_millis(1),
                    )
                })
            })
            .collect();
        group(rank(&items, NOW))
    }

    #[test]
    fn the_count_is_sessions_waiting_not_items() {
        let w = Wip::of(&groups(&["a", "b"], 5), 4);
        assert_eq!(w.sessions_waiting, 2);
        assert_eq!(w.items, 10);
        assert!(
            !w.over(),
            "ten items across two sessions is not being the bottleneck"
        );
    }

    #[test]
    fn five_sessions_waiting_is_over_the_default() {
        let w = Wip::of(&groups(&["a", "b", "c", "d", "e"], 1), Wip::DEFAULT_LIMIT);
        assert!(w.over());
    }

    #[test]
    fn an_empty_queue_is_never_over() {
        assert!(!Wip::of(&[], 0).over());
    }
}

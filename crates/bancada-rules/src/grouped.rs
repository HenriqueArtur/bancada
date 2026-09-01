use crate::Ranked;
use bancada_meta::{DecisionKind, SessionId};

/// The queue as it is shown: items of one session together, sessions in
/// the order of their strongest item.
///
/// Grouping is display, not ranking. The order between groups is decided
/// by the best item in each, so a session never floats up because it has
/// many trivial things pending.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Grouped {
    pub session: SessionId,
    pub items: Vec<Ranked>,
}

impl Grouped {
    /// The score that places this group among the others.
    pub fn score(&self) -> u64 {
        self.items.first().map(|r| r.score).unwrap_or(0)
    }

    /// Fold identical trivia into one line.
    ///
    /// Three permission requests of the same shape are one item, not
    /// three. Deduplication is the known defence against alarm fatigue,
    /// and a queue of individual permission prompts dies of it in a week.
    pub fn collapsed(&self) -> Vec<(DecisionKind, usize)> {
        let mut out: Vec<(DecisionKind, usize)> = Vec::new();
        for r in &self.items {
            match out.last_mut() {
                Some((k, n)) if *k == r.item.kind && collapsible(*k) => *n += 1,
                _ => out.push((r.item.kind, 1)),
            }
        }
        out
    }
}

/// Only trivia collapses. Two architecture choices are two decisions, and
/// folding them would hide one behind the other — which is the thing the
/// per-decision queue exists to prevent.
const fn collapsible(kind: DecisionKind) -> bool {
    matches!(kind, DecisionKind::Permission)
}

/// Group a ranked queue by session, strongest group first.
pub fn group(ranked: Vec<Ranked>) -> Vec<Grouped> {
    let mut out: Vec<Grouped> = Vec::new();
    for r in ranked {
        match out.iter_mut().find(|g| g.session == r.item.session) {
            Some(g) => g.items.push(r),
            None => out.push(Grouped {
                session: r.item.session.clone(),
                items: vec![r],
            }),
        }
    }
    out.sort_by(|a, b| b.score().cmp(&a.score()));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{QueueItem, rank};
    use bancada_meta::Timestamp;

    const NOW: Timestamp = Timestamp::from_millis(10_000_000);

    fn item(session: &str, kind: DecisionKind, age_ms: i64) -> QueueItem {
        QueueItem::new(
            SessionId::new(session),
            kind,
            Timestamp::from_millis(NOW.as_millis() - age_ms),
        )
    }

    fn grouped(items: Vec<QueueItem>) -> Vec<Grouped> {
        group(rank(&items, NOW))
    }

    #[test]
    fn items_of_one_session_end_up_together() {
        let g = grouped(vec![
            item("a", DecisionKind::Question, 1_000),
            item("b", DecisionKind::Question, 2_000),
            item("a", DecisionKind::Review, 3_000),
        ]);
        assert_eq!(g.len(), 2);
        let a = g.iter().find(|g| g.session == SessionId::new("a")).unwrap();
        assert_eq!(a.items.len(), 2);
    }

    #[test]
    fn a_group_is_placed_by_its_strongest_item_not_by_how_many_it_has() {
        let g = grouped(vec![
            // Four trivial things, all recent.
            item("many", DecisionKind::Permission, 1_000),
            item("many", DecisionKind::Permission, 1_000),
            item("many", DecisionKind::Permission, 1_000),
            item("many", DecisionKind::Permission, 1_000),
            // One costly thing, long overdue.
            item("one", DecisionKind::PlanApproval, 3_600_000),
        ]);
        assert_eq!(
            g[0].session,
            SessionId::new("one"),
            "volume outranked weight"
        );
    }

    #[test]
    fn identical_permissions_collapse_into_one_line() {
        let g = grouped(vec![
            item("a", DecisionKind::Permission, 1_000),
            item("a", DecisionKind::Permission, 1_000),
            item("a", DecisionKind::Permission, 1_000),
        ]);
        assert_eq!(g[0].collapsed(), vec![(DecisionKind::Permission, 3)]);
    }

    #[test]
    fn two_costly_decisions_never_collapse() {
        let g = grouped(vec![
            item("a", DecisionKind::Question, 1_000),
            item("a", DecisionKind::Question, 1_000),
        ]);
        assert_eq!(g[0].collapsed().len(), 2, "one question hid behind another");
    }

    #[test]
    fn an_empty_queue_groups_into_nothing() {
        assert!(grouped(vec![]).is_empty());
    }
}

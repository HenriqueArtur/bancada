use crate::QueueItem;
use bancada_meta::Timestamp;
use serde::{Deserialize, Serialize};

/// A queue item with the arithmetic that placed it, kept rather than
/// discarded.
///
/// The breakdown is the feature: weights and thresholds per project make
/// the order opaque, and a queue nobody trusts is a queue nobody reads.
/// Keeping the factors costs nothing, because they were all computed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ranked {
    pub item: QueueItem,
    pub score: u64,
    pub age_ms: i64,
    pub kind_factor: u32,
    pub weighted_age_ms: i64,
    pub blocking_factor: u32,
}

/// Rank items highest-first, given the current time.
///
/// `now` is a parameter and never a call. See the crate docs.
///
/// `score = kind × (age × project weight) × (1 + blocking)`
///
/// Weight scales *time*; it does not override the kind. That is what keeps
/// a permission on the critical project below an architecture choice on
/// the dormant one — the failure mode a dominant priority tier has, and
/// the reason the queue stays trustworthy.
pub fn rank(items: &[QueueItem], now: Timestamp) -> Vec<Ranked> {
    let mut out: Vec<Ranked> = items
        .iter()
        .map(|item| {
            let age_ms = item.raised_at.elapsed_to(now);
            let kind_factor = item.kind.weight();
            let weighted_age_ms = age_ms.saturating_mul(i64::from(item.project_weight));
            let blocking_factor = 1 + item.blocking;
            let score = (u64::from(kind_factor))
                .saturating_mul(weighted_age_ms.max(0) as u64)
                .saturating_mul(u64::from(blocking_factor));
            Ranked {
                item: item.clone(),
                score,
                age_ms,
                kind_factor,
                weighted_age_ms,
                blocking_factor,
            }
        })
        .collect();

    // Highest score first; ties broken by the older item, so the order is
    // total and a rerun cannot shuffle two equal items.
    out.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then(a.item.raised_at.cmp(&b.item.raised_at))
    });
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use bancada_meta::{DecisionKind, SessionId};

    fn item(kind: DecisionKind, raised_ms: i64) -> QueueItem {
        QueueItem::new(SessionId::new("s"), kind, Timestamp::from_millis(raised_ms))
    }

    const NOW: Timestamp = Timestamp::from_millis(3_600_000);

    #[test]
    fn the_older_of_two_equal_items_ranks_first() {
        let items = vec![
            item(DecisionKind::Question, 3_000_000),
            item(DecisionKind::Question, 1_000_000),
        ];
        let r = rank(&items, NOW);
        assert_eq!(r[0].item.raised_at, Timestamp::from_millis(1_000_000));
    }

    #[test]
    fn weight_scales_time_without_overriding_the_kind() {
        // A two-second-old permission on a weight-10 project, against an
        // hour-old plan approval on a baseline project.
        let items = vec![
            item(DecisionKind::Permission, NOW.as_millis() - 2_000).with_weight(10),
            item(DecisionKind::PlanApproval, 0),
        ];
        let r = rank(&items, NOW);
        assert_eq!(
            r[0].item.kind,
            DecisionKind::PlanApproval,
            "a heavy project let a trivial decision outrank a costly one"
        );
    }

    #[test]
    fn weight_does_decide_between_two_items_of_the_same_kind() {
        let items = vec![
            item(DecisionKind::Question, NOW.as_millis() - 600_000),
            item(DecisionKind::Question, NOW.as_millis() - 300_000).with_weight(3),
        ];
        let r = rank(&items, NOW);
        assert_eq!(
            r[0].item.project_weight, 3,
            "5 min at weight 3 should beat 10 min at weight 1"
        );
    }

    #[test]
    fn an_item_that_blocks_others_ranks_above_an_equal_one_that_does_not() {
        let items = vec![
            item(DecisionKind::Review, 0),
            item(DecisionKind::Review, 0).blocking(2),
        ];
        let r = rank(&items, NOW);
        assert_eq!(r[0].item.blocking, 2);
    }

    #[test]
    fn the_breakdown_multiplies_back_to_the_score() {
        let items = vec![item(DecisionKind::Question, 0).with_weight(2).blocking(1)];
        let r = &rank(&items, NOW)[0];
        let expected =
            u64::from(r.kind_factor) * (r.weighted_age_ms as u64) * u64::from(r.blocking_factor);
        assert_eq!(
            r.score, expected,
            "the explanation must reproduce the number"
        );
    }

    #[test]
    fn an_item_raised_after_the_clock_we_were_given_scores_zero_rather_than_negative() {
        let items = vec![item(DecisionKind::Question, NOW.as_millis() + 10_000)];
        let r = rank(&items, NOW);
        assert_eq!(r[0].age_ms, 0);
        assert_eq!(r[0].score, 0);
    }

    #[test]
    fn ranking_nothing_yields_nothing() {
        assert!(rank(&[], NOW).is_empty());
    }
}

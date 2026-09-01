use crate::{Pending, QueueItem};
use bancada_meta::{DecisionKind, MetaEvent, SessionId, Timestamp};

/// What one session looks like right now, from metadata alone.
///
/// Derived, not recorded: the log has no line saying a turn began or
/// ended. `awaiting_human` means the last thing that happened was the
/// agent talking — which is the closest the format gets to "your turn".
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionState {
    pub session: SessionId,
    pub last_activity: Timestamp,
    pub pending: Vec<Pending>,
    pub agent_last_spoke: Option<Timestamp>,
    pub awaiting_human: bool,
}

impl SessionState {
    fn new(session: SessionId, at: Timestamp) -> Self {
        Self {
            session,
            last_activity: at,
            pending: Vec::new(),
            agent_last_spoke: None,
            awaiting_human: false,
        }
    }

    /// Reduce a stream of facts to one state per session.
    ///
    /// Order is the order given. Sessions come back in the order they were
    /// first seen, so the output is stable across runs.
    pub fn fold(events: &[MetaEvent]) -> Vec<Self> {
        let mut out: Vec<Self> = Vec::new();

        for e in events {
            let at = e.at();
            let idx = match out.iter().position(|s| &s.session == e.session()) {
                Some(i) => i,
                None => {
                    out.push(Self::new(e.session().clone(), at));
                    out.len() - 1
                }
            };
            let s = &mut out[idx];
            s.last_activity = at;

            match e {
                // The only fact that means "your turn". Everything else is
                // the session still moving.
                MetaEvent::AgentSpoke { .. } => {
                    s.agent_last_spoke = Some(at);
                    s.awaiting_human = true;
                }
                MetaEvent::DecisionRaised { id, kind, .. } => {
                    s.awaiting_human = false;
                    s.pending.push(Pending {
                        id: id.clone(),
                        kind: *kind,
                        at,
                    });
                }
                MetaEvent::ToolCompleted { id, .. } => {
                    s.awaiting_human = false;
                    s.pending.retain(|p| &p.id != id);
                }
                // Bookkeeping on a message already accounted for, not
                // new activity. Token counts arrive *after* the prose of
                // the same message, so treating them as movement erases
                // the turn ending that just happened — which is what a
                // real log does and a hand-built one does not.
                MetaEvent::Tokens { .. } => {}
                _ => s.awaiting_human = false,
            }
        }

        out
    }

    /// The queue: what needs the human, and nothing else.
    ///
    /// A pending decision is listed at once. A finished turn is listed
    /// only after `idle_after_ms` of silence — in observe mode nothing
    /// distinguishes *finished* from *about to continue* except time, and
    /// waiting does the triage for free.
    pub fn queue(states: &[Self], now: Timestamp, idle_after_ms: i64) -> Vec<QueueItem> {
        let mut items = Vec::new();

        for s in states {
            // The unit is the decision: two pending things in one session
            // are two items, and neither may hide behind the other.
            for p in &s.pending {
                items.push(QueueItem::new(s.session.clone(), p.kind, p.at).raised_by(&p.id));
            }
            if !s.pending.is_empty() {
                continue;
            }
            if let Some(spoke) = s.agent_last_spoke
                && s.awaiting_human
                && spoke.elapsed_to(now) >= idle_after_ms
            {
                items.push(QueueItem::new(
                    s.session.clone(),
                    DecisionKind::Review,
                    spoke,
                ));
            }
        }

        items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const IDLE: i64 = 120_000;
    const NOW: Timestamp = Timestamp::from_millis(1_000_000);

    fn s(n: &str) -> SessionId {
        SessionId::new(n)
    }
    fn at(ms: i64) -> Timestamp {
        Timestamp::from_millis(ms)
    }
    fn spoke(n: &str, ms: i64) -> MetaEvent {
        MetaEvent::AgentSpoke {
            session: s(n),
            at: at(ms),
        }
    }
    fn human(n: &str, ms: i64) -> MetaEvent {
        MetaEvent::HumanSpoke {
            session: s(n),
            at: at(ms),
        }
    }
    fn asked(n: &str, ms: i64, id: &str) -> MetaEvent {
        MetaEvent::DecisionRaised {
            session: s(n),
            at: at(ms),
            id: id.into(),
            kind: DecisionKind::Question,
        }
    }
    fn done(n: &str, ms: i64, id: &str) -> MetaEvent {
        MetaEvent::ToolCompleted {
            session: s(n),
            at: at(ms),
            id: id.into(),
            ok: true,
        }
    }
    fn called(n: &str, ms: i64, id: &str) -> MetaEvent {
        MetaEvent::ToolCalled {
            session: s(n),
            at: at(ms),
            id: id.into(),
            tool: "Bash".into(),
        }
    }
    fn queue_of(events: &[MetaEvent]) -> Vec<QueueItem> {
        SessionState::queue(&SessionState::fold(events), NOW, IDLE)
    }

    #[test]
    fn criterion_1_a_pending_decision_is_listed_at_once() {
        let q = queue_of(&[human("a", 10), asked("a", NOW.as_millis() - 1, "t1")]);
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].kind, DecisionKind::Question);
    }

    #[test]
    fn criterion_2_a_turn_that_just_ended_is_not_listed_yet() {
        let q = queue_of(&[human("a", 10), spoke("a", NOW.as_millis() - 1_000)]);
        assert!(q.is_empty(), "listed a turn that may still continue");
    }

    #[test]
    fn criterion_3_the_same_turn_is_listed_once_it_has_been_silent() {
        let spoke_at = NOW.as_millis() - IDLE;
        let q = queue_of(&[human("a", 10), spoke("a", spoke_at)]);
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].kind, DecisionKind::Review);
        assert_eq!(
            q[0].raised_at,
            at(spoke_at),
            "aged from when the agent stopped"
        );
    }

    #[test]
    fn criterion_4_a_session_where_the_human_spoke_last_is_not_yours_to_act_on() {
        let q = queue_of(&[spoke("a", 10), human("a", 20)]);
        assert!(q.is_empty());
    }

    #[test]
    fn criterion_5_a_session_still_calling_tools_never_appears_however_long_it_runs() {
        let q = queue_of(&[
            human("a", 10),
            spoke("a", 20),
            called("a", 30, "t1"),
            done("a", 40, "t1"),
        ]);
        assert!(q.is_empty(), "silence is the signal, not duration");
    }

    #[test]
    fn criterion_6_a_resolved_decision_leaves_no_item() {
        let q = queue_of(&[human("a", 10), asked("a", 20, "t1"), done("a", 30, "t1")]);
        assert!(q.is_empty(), "the answer arrived and the item stayed");
    }

    #[test]
    fn criterion_7_two_pending_things_in_one_session_are_two_items() {
        let q = queue_of(&[human("a", 10), asked("a", 20, "t1"), asked("a", 30, "t2")]);
        assert_eq!(q.len(), 2, "one hid behind the other");
    }

    #[test]
    fn token_counts_do_not_count_as_the_session_moving() {
        // The real log emits usage right after the assistant's prose. If
        // that reads as activity, every finished turn looks alive.
        let spoke_at = NOW.as_millis() - IDLE;
        let q = queue_of(&[
            human("a", 10),
            spoke("a", spoke_at),
            MetaEvent::Tokens {
                session: s("a"),
                at: at(spoke_at),
                input: 1,
                output: 2,
                cache_read: 3,
                cache_creation: 4,
            },
        ]);
        assert_eq!(q.len(), 1, "usage erased the turn that had just ended");
        assert_eq!(q[0].kind, DecisionKind::Review);
    }

    #[test]
    fn criterion_8_folding_the_same_events_twice_yields_the_same_states() {
        let ev = [human("a", 10), spoke("a", 20), asked("b", 30, "t1")];
        assert_eq!(SessionState::fold(&ev), SessionState::fold(&ev));
    }

    #[test]
    fn sessions_come_back_in_the_order_they_were_first_seen() {
        let ev = [human("b", 10), human("a", 20), human("b", 30)];
        let f = SessionState::fold(&ev);
        assert_eq!(f.len(), 2);
        assert_eq!(f[0].session, s("b"));
    }

    #[test]
    fn a_pending_decision_hides_the_review_item_rather_than_adding_to_it() {
        // The agent spoke, went quiet, and is also waiting on an answer.
        // One session, one thing to do — not two.
        let q = queue_of(&[
            human("a", 10),
            spoke("a", NOW.as_millis() - IDLE),
            asked("a", NOW.as_millis() - IDLE, "t1"),
        ]);
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].kind, DecisionKind::Question);
    }
}

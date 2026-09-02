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
    /// The first thing that happened in it — when the session began.
    ///
    /// Kept beside `last_activity` because the two answer different
    /// questions: one is "is this still moving", the other is "is this the
    /// work I have moved on to". See [`SessionState::queue`].
    pub began: Timestamp,
    pub last_activity: Timestamp,
    pub pending: Vec<Pending>,
    pub agent_last_spoke: Option<Timestamp>,
    pub awaiting_human: bool,
}

impl SessionState {
    fn new(session: SessionId, at: Timestamp) -> Self {
        Self {
            session,
            began: at,
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
    ///
    /// `states` is **every session of one project**, not one of them. The
    /// rule below is about the sessions beside each other, and a caller
    /// folding one log at a time would ask it a question it cannot answer.
    ///
    /// `kept` names the sessions a newer one may not quiet.
    pub fn queue(
        states: &[Self],
        now: Timestamp,
        idle_after_ms: i64,
        kept: &[SessionId],
    ) -> Vec<QueueItem> {
        let mut items = Vec::new();
        // No sessions, so nothing to compare against and nothing to walk.
        let Some(newest) = Self::current(states).map(|s| s.began) else {
            return items;
        };

        for s in states {
            // The unit is the decision: two pending things in one session
            // are two items, and neither may hide behind the other.
            for p in &s.pending {
                items.push(QueueItem::new(s.session.clone(), p.kind, p.at).raised_by(&p.id));
            }
            if !s.pending.is_empty() {
                continue;
            }
            if !s.speaks_up(newest, kept) {
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

    /// The session you moved to: the last one opened.
    ///
    /// The other half of [`SessionState::quieted`], and the half that was
    /// missing. The rule reads opening a session as saying you have moved
    /// on, but it said so only as a subtraction on the rows it silenced —
    /// nothing named the session that did the silencing. On screen the one
    /// you had just opened was drawn exactly like one that had merely gone
    /// quiet without being quieted, which is the state every session sits
    /// in for its first `idle_after_ms`. Reported as: the old ones went
    /// inactive and the new one was never made active.
    ///
    /// `began`, not `last_activity`. The question is which session you
    /// opened last, not which one is moving: a parallel session still
    /// producing events is not the one you moved to, and it goes on asking
    /// on its own account rather than on this one's.
    ///
    /// Never a session that is quieted — this one's own activity is at
    /// least its own beginning, so it always speaks for itself.
    pub fn current(states: &[Self]) -> Option<&Self> {
        states.iter().max_by_key(|s| s.began)
    }

    /// The sessions this rule is holding back.
    ///
    /// What would be asking if every session were kept, minus what is
    /// asking now. Said as a subtraction rather than as a second copy of
    /// the rule, because a second copy is a second thing to keep in step.
    ///
    /// The screen needs it: a session quiet because you moved on and a
    /// session quiet because nothing has happened look identical, and only
    /// one of them has a switch. A silence you cannot find the switch for
    /// is the failure ADR-023 is written against.
    pub fn quieted(
        states: &[Self],
        now: Timestamp,
        idle_after_ms: i64,
        kept: &[SessionId],
    ) -> Vec<SessionId> {
        let all: Vec<SessionId> = states.iter().map(|s| s.session.clone()).collect();
        let asking = Self::queue(states, now, idle_after_ms, kept);
        Self::queue(states, now, idle_after_ms, &all)
            .into_iter()
            .map(|i| i.session)
            .filter(|s| !asking.iter().any(|a| &a.session == s))
            .collect()
    }

    /// Whether a *finished turn* here is still worth your eyes.
    ///
    /// Opening a session is how you say you have moved on from the last one.
    /// Without this the queue had no unit for "that one is over": a session
    /// you walked away from stays `awaiting_human` forever, because the only
    /// thing that clears it is a next event and an abandoned session has
    /// none — and since a score multiplies by age, it grew louder every
    /// minute until it outranked the session you were actually in.
    ///
    /// Quiets only what had **already stopped** when the newer session
    /// began. A session still producing events past that moment is work
    /// happening in parallel, and the whole product is for people running
    /// several at once; silencing those would be the cure killing the
    /// patient. `kept` is the manual override for the one that legitimately
    /// sits idle — the long-running session you will come back to.
    ///
    /// A *raised decision* never consults this: an agent that has stopped
    /// and cannot continue is the one thing that must always reach you.
    fn speaks_up(&self, newest: Timestamp, kept: &[SessionId]) -> bool {
        self.last_activity >= newest || kept.contains(&self.session)
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
        SessionState::queue(&SessionState::fold(events), NOW, IDLE, &[])
    }
    fn queue_keeping(events: &[MetaEvent], kept: &[SessionId]) -> Vec<QueueItem> {
        SessionState::queue(&SessionState::fold(events), NOW, IDLE, kept)
    }
    fn sessions(q: &[QueueItem]) -> Vec<&str> {
        q.iter().map(|i| i.session.as_str()).collect()
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

    // ── a newer session says you have moved on ───────────────────────────

    /// Two sessions: one that stopped, and one that began after it stopped.
    ///
    /// Both are old enough to be listed on their own, so anything missing
    /// from the queue was quieted rather than merely too fresh.
    fn walked_away() -> [MetaEvent; 4] {
        [
            human("old", 10),
            spoke("old", 500_000),
            human("new", 600_000),
            spoke("new", 700_000),
        ]
    }

    #[test]
    fn a_session_you_walked_away_from_stops_asking_once_a_newer_one_begins() {
        // Reported from the screen: both the abandoned session and the one
        // just opened were marked as needing you. Nothing ever cleared the
        // first, because the only thing that clears `awaiting_human` is a
        // next event and an abandoned session has none.
        assert_eq!(sessions(&queue_of(&walked_away())), vec!["new"]);
    }

    #[test]
    fn a_session_still_working_beside_a_newer_one_is_not_quieted() {
        // Two agents at once is what this product is *for*. The rule quiets
        // what had already stopped, not what is running.
        let q = queue_of(&[
            human("busy", 10),
            called("busy", 650_000, "t1"),
            done("busy", 660_000, "t1"),
            spoke("busy", 700_000),
            human("new", 600_000),
            spoke("new", 700_000),
        ]);
        assert_eq!(sessions(&q), vec!["busy", "new"]);
    }

    #[test]
    fn a_kept_session_goes_on_asking_however_many_begin_after_it() {
        // The long-running one you will come back to. It sits idle, so the
        // rule would quiet it, and saying so by hand is the whole override.
        let q = queue_keeping(&walked_away(), &[s("old")]);
        assert_eq!(sessions(&q), vec!["old", "new"]);
    }

    #[test]
    fn a_newer_session_never_quiets_an_agent_that_is_stopped_on_a_question() {
        // A finished turn can wait. An agent that cannot continue without
        // an answer is the one thing that must always reach you — and it is
        // the row that would be worst to lose to a rule about tidiness.
        let q = queue_of(&[
            human("old", 10),
            asked("old", 500_000, "t1"),
            human("new", 600_000),
        ]);
        assert_eq!(sessions(&q), vec!["old"]);
        assert_eq!(q[0].kind, DecisionKind::Question);
    }

    #[test]
    fn the_current_session_is_the_last_one_you_opened() {
        // The other side of the same fact. `old` is quieted, and something
        // has to say which session did the quieting — without it the new
        // one is drawn exactly like a session that has merely gone silent.
        let states = SessionState::fold(&walked_away());
        assert_eq!(
            SessionState::current(&states).map(|s| s.session.clone()),
            Some(s("new"))
        );
    }

    #[test]
    fn the_one_you_opened_last_is_current_even_while_another_still_runs() {
        // `busy` is the more recently *active* of the two and is not
        // quieted, but you did not move to it. Answered from `began`, which
        // is why the two questions are separate fields.
        let states = SessionState::fold(&[
            human("new", 600_000),
            spoke("new", 610_000),
            human("busy", 10),
            spoke("busy", 700_000),
        ]);
        assert_eq!(
            SessionState::current(&states).map(|s| s.session.clone()),
            Some(s("new"))
        );
    }

    #[test]
    fn the_current_session_is_never_one_of_the_quieted() {
        // Two names for one row would be a screen contradicting itself, and
        // the rule makes it impossible: a session's last activity is at
        // least its own beginning, so the newest always speaks for itself.
        let states = SessionState::fold(&walked_away());
        let current = SessionState::current(&states).expect("one").session.clone();
        assert!(!SessionState::quieted(&states, NOW, IDLE, &[]).contains(&current));
    }

    #[test]
    fn a_project_with_no_sessions_yet_has_an_empty_queue() {
        // There is no newest session to compare against, and the rule below
        // is written as if there always is one. Answered before the walk
        // rather than by a branch inside it that nothing could reach.
        assert!(SessionState::queue(&[], NOW, IDLE, &[]).is_empty());
    }

    #[test]
    fn the_quieted_ones_are_named_so_a_screen_can_say_why_they_are_silent() {
        let states = SessionState::fold(&walked_away());
        let held = SessionState::quieted(&states, NOW, IDLE, &[]);
        assert_eq!(
            held.iter().map(SessionId::as_str).collect::<Vec<_>>(),
            ["old"]
        );

        // Kept, it is asking rather than held back — the two lists are the
        // same fact from opposite sides and must never both claim it.
        assert!(SessionState::quieted(&states, NOW, IDLE, &[s("old")]).is_empty());
    }

    #[test]
    fn a_session_nothing_has_happened_in_is_not_reported_as_quieted() {
        // Silent because the turn is yours, not because a newer one began.
        // Told apart, one of them has a switch and the other does not.
        let states = SessionState::fold(&[human("a", 10), human("b", 20)]);
        assert!(SessionState::quieted(&states, NOW, IDLE, &[]).is_empty());
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

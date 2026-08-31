# 0003 — Session state and the queue

**status** done — 10 tests, all eight criteria
**features** G0.1, G0.2, G0.5
**decisions** ADR-004 (no AI in the engine), hard rule 2
**depends on** [0002](0002-session-log-parser.md)

## Intent

Turn a stream of metadata facts into the one screen that answers *what needs me
now*. This is the spine: everything else in the product is reached from an item
in it.

## What deriving turns exposed

The projection mapped `Usage` onto `TurnEnded`, so **every assistant message
looked like a turn ending**. That was a leftover from the model written before
any log was read.

The fix is not a better guess. It is admitting which facts the log actually
carries:

```
HumanSpoke     a human turn happened          — the turn opener
AgentSpoke     the agent produced prose       — the turn's last breath
ToolCalled     which tool, never its input
FileTouched    which path, never its contents
DecisionRaised a question, a permission, a plan
Errored        the tool failed
Tokens         counts, per message, not per turn
```

Every one is a line in the log. None can hold what was said. **Turn boundaries
are derived from `HumanSpoke`, not recorded** — which is only possible because
"a human spoke" is a fact separate from what they said.

## Contract

```
SessionState::fold(events: &[MetaEvent]) -> Vec<SessionState>

SessionState {
    session, last_activity,
    pending: Option<Pending>,      // raised and unresolved
    agent_last_spoke: Option<Timestamp>,
    awaiting_human: bool,
}

SessionState::queue(states, now, idle_after) -> Vec<QueueItem>
```

## The rule for a finished turn

A turn that ends with nothing pending becomes a `Review` item **only after the
session has been silent for `idle_after`**.

In observe mode there is no way to tell *finished* from *about to continue* at
the moment it happens — only time separates them. Waiting does the triage for
free: a turn that continues never reaches the queue at all, and one that really
stopped arrives.

The cost is honest: a delay between done and visible. The alternative — listing
every finished turn immediately — fills the queue with items you will not act
on, and a queue like that stops being read, which costs more.

`idle_after` is a per-project threshold like every other number in the engine.

## Acceptance criteria

1. A session whose last fact is `DecisionRaised` is in the queue immediately,
   with that kind.
2. A session whose agent spoke and then went silent for less than `idle_after`
   is **not** in the queue.
3. The same session, once silent for `idle_after` or more, is in the queue as
   `Review`, aged from when the agent last spoke.
4. A session where the human spoke last is not in the queue: the turn is the
   agent's, not yours.
5. A session still calling tools is not in the queue however long it runs —
   silence is the signal, not duration.
6. A decision that was raised and then resolved leaves no item.
7. One session with a pending question **and** a scope escape yields two items,
   because the unit is the decision.
8. Folding the same events twice yields the same states.

## Out of scope

- **Ranking.** 0004. This produces items; ordering them is separate.
- **Stalled detection.** A session silent far past normal is G3.1, and it needs
  per-project thresholds this spec does not read.
- **Grouping and WIP.** They read the queue; they do not build it.

## How resolution became visible

Writing criterion 6 exposed that a decision's *resolution* had no marker: a
question is answered by a `tool_result`, and the projection discarded
successful ones.

The fix needed no new permission and no content. **The call id is metadata.**
`DecisionRaised` carries the id that raised it, `ToolCompleted` carries the id
that finished, and a decision is pending until the two match. Nothing reads a
word of the answer to know that an answer arrived.

That also removed a variant: `Errored` became `ToolCompleted { ok }`, because
"the tool failed" and "the call finished" are the same fact seen twice.

## One rule the criteria did not ask for

A session that is both silent *and* waiting on an answer yields **one** item,
not two. The pending decision hides the review rather than adding to it: there
is one thing to do there, and listing it twice is the queue lying about its own
length — which is what a WIP limit reads.

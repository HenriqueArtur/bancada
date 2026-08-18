# G2 · Reviewing

## G2.1 ★ Diff against declared intent `[content]`

The signature feature. Not the raw diff — the diff **beside what the session
said it would do**, with the deviation marked. The intent is in the log: in the
plan, in the answer before execution.

Turns review from "read 400 lines" into "look at the 3 places where it left the
agreement".

## G2.2 ○ Incremental diff `[content]`

What changed since *I* last reviewed — not since the last commit.

## G2.3 ★ Early reviewability warning `[meta]`

Watches the diff grow and warns when the session passes the reviewable range,
**while there is still time to act**. The same reviewer produces signal on 150
lines and noise on 1,000, and that is decided during the session, not at review
time. The entire field reviews at the end.

Warns, does not block. The limit is **per project**
([G6.6](G6-governance.md)): in a large refactor 900 lines is expected, and
warning at 500 there would be pure noise.

## G2.5 ★ Automated gate before it reaches you `[meta]`

At session end, runs tests, lint and typecheck. **It enters the queue only if
they pass.** Failed, it goes back to the agent — not to you.

The justification comes from the field: *verification is the bottleneck,
because agents generate code faster than humans review it, so automation must
filter most of it before a human sees a diff.*

It is the only feature in the whole product that **removes** items from the
queue instead of adding them. That probably makes it the most aligned with the
thesis.

## G2.4 ○ Step graph — ⏸ **deferred, not cut** `[content]`

Borrowed from tools serving a different user (people debugging agents in
production). Likely overlaps G1.1 and G2.1: if context restoration and
diff-against-intent answer "what happened while I was away" well, this
visualisation need not exist. Revisit after using both. It would be the session
as a sequence of steps — planning, tool calls, retries — instead of chat
scroll.

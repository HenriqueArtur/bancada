# G0 · The queue — the spine

The screen that opens. Everything else is reached from an item in it.

```
┌─ NEEDS YOU · 3 sessions, 4 items ────────────┐
│                                               │
│  sunne/SunneCore                              │
│    1h20   route choice                        │
│    10min  touched a file outside scope        │
│                                               │
│  publico/blog                                 │
│    40min  approve plan                        │
│                                               │
│  sunne/api-interna                            │
│    12min  3 grouped permissions               │
└───────────────────────────────────────────────┘
```

## G0.1 ★ Unified queue `[meta]`

Across workspaces, runtimes and accounts. The only screen that answers "what
do I do now".

## G0.2 ★ Per decision, grouped by session `[meta]`

The unit is the decision. A pending question and a scope escape in the same
session are two things, need two actions, and neither may hide behind the
other. Items from one session group visually so the queue does not explode.

## G0.3 ★ Ranked by cost of delay × cost of being wrong `[meta]`

Not arrival order. `score = kind × (age × project weight) × blocking`, all
deterministic.

**Weight answers "how fast does waiting hurt here"**, not "which project
matters more". It scales time without overriding the kind of decision — so a
permission on the critical project still ranks below an architecture choice on
the dormant one. See [G6.6](G6-governance.md).

## G0.8 ◐ Explainable ranking, on demand `[meta]`

Clicking an item opens the score breakdown. Per-project weights and thresholds
make the order opaque, and a queue you do not trust is a queue you ignore —
which sends you back to four terminals. It stays off the screen so it does not
clutter the dark cockpit, and it is there when you doubt. Nearly free: the
arithmetic is already deterministic, it only needs showing.

## G0.4 ★ Grouping `[meta]`

Three permissions of the same shape are one item, not three. Deduplication and
grouping are the known defense against alarm fatigue; a queue of individual
permission prompts dies of it within a week.

## G0.5 ○ Dark cockpit

Empty queue, empty screen. Nothing lights up that does not ask for action. If
an item can appear when there is nothing to do, the whole queue loses meaning.

## G0.6 ★ WIP limit `[meta]`

The ceiling is **sessions waiting on you**, not sessions running. Six working
cost you no attention; five stalled mean you became the bottleneck. It
confronts, it does not block.

A defensible default instead of a guess: Google Research reports diminishing
returns beyond five parallel agents, with **2–4 as the working range** —
coordination overhead grows faster than throughput. See
[../REFERENCES.md](../REFERENCES.md).

## G0.7 ◐ Focus mode `[meta]`

Silences everything for N minutes except what you mark urgent. The honest
complement of an attention product — a queue that interrupts constantly is the
same fragmentation under another name.

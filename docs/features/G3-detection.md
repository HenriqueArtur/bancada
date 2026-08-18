# G3 · Seeing what you would not

None of these produce a question from the agent. All of them vanish into
scroll today.

## G3.1 ○ Obvious stagnation — rules `[meta]`

Continuous and free: same file edited N times; N thousand tokens with no file
changing; no event for X minutes with a live process; the same command failing
repeatedly; total duration beyond what is normal for that project.

All limits are **per project** ([G6.6](G6-governance.md)) — a 5-hour session is
normal in a large refactor and strange almost everywhere else.

## G3.7 ◐ Collision between sessions `[meta]`

Two sessions touching the same file — or the same config file, routing table or
component registry, which is where the conflict hurts most. It is the **most
reported failure** of parallel agents, and it is structurally invisible:
neither agent can know about the other. The paths are in the log; detection is
pure metadata and comes free.

## G3.8 ◐ Context blindness between sessions `[content]`

The expensive version of the above: *agent A knows about the schema change,
agent B knows about the API contract, neither knows about the other* —
individually correct code that breaks when combined. It passes compile and
lint, so no gate catches it.

Detecting it properly needs content and cross-session comparison, which hits
the boundary when the sessions are in different workspaces; within one
workspace it is feasible. Cheap metadata proxy: two sessions in modules that
import each other.

## G3.9 ◐ Warning before compaction `[meta]`

Field practice is to **start preparing handoff at about 60% of the context
window**. Today compaction simply happens, the agent "forgets", and there is no
signal at all — you find out from a strange answer half an hour later. The
token counts are in the log, so detecting this is free, and it turns a silent
failure into a warning.

## G3.10 ○ Compaction record `[meta]`

When a session compacted and what got summarised away. Explains the confusion
that follows, and feeds the post-mortem (G3.6).

## G3.3 ◐ Scope escape `[meta]`

The session touched a file outside the agreement. Paths only, no content.

## G3.4 ◐ "Finished" vs "only reported" `[content]`

The classification that enables the one agreed automation
([G4.1](G4-automation.md)). It needs judgement: from the outside the two look
identical.

## G3.2 ◐ Semantic drift — periodic AI `[content]`

Covers the blind spot of rules: *it tried four different approaches to the same
problem, each plausible* — the expensive kind of stuck. Runs inside the
workspace, every N minutes, **only on sessions the rules already flagged as
suspect**.

## G3.5 ★ Resource pressure, with real overcommit `[meta]`

Disk, memory, swap and load — **from the host and the guest**, crossed.

The point is not to show "disk at 69%". It is that **the guest's view is a
lie**: a monitor inside the VM reads "69% used, 9 G free, all fine" while the
host walks toward ENOSPC. Nothing inside the VM can know — not `df`, not the
harness, not any tool in the field, because they all run on the wrong side of
the boundary. Only a host-side observer sees the number that matters, and the
rules engine is already there.

Measured on this machine, 2026-08-14, as a real case:

```
Mac                    27 GiB free · 88% full
  ~/.lima/sunne        19 G of 30 G thin-provisioned
  ~/.lima/devbox      6.3 G of 30 G thin-provisioned

guest sunne: "9.0 G free"   ← believes this
guests together believe ~33 G · host has 27 GiB
```

The signature metric is **overcommit**: *"the guests believe they have 33 G;
the host has 27 G"* — a number that exists only in the crossing.

Memory matters too: 3.8 GiB per VM and **swap 0B**. Without swap there is no
degradation — the OOM killer fires immediately, with no warning.

Becomes a **queue item** when it crosses the limit, with the same ranking and
the same dark cockpit: it is a decision only you can take (stop a session,
clear a cache, move a folder) and it arrives while you can still choose which
to sacrifice.

*Collection:* host continuous and cheap (`df`, `stat`, every ~30s); guest
**adaptive**, because each read costs a shell into the runtime — slow at rest,
accelerating as the host tightens. On a 16 GiB Mac with two VMs, the monitor
cannot be part of the problem. Uses `Runtime.exec()`, **not** the supervisor:
no account, no content, no workspace crossed.

## G3.6 ★ Session death post-mortem `[meta]`

Today a session dies and it is a mystery. With host and guest resource history
it becomes an answer: *"it did not hang — it was OOM-killed at 14:32, when
memory hit 3.8 G, and there was no swap"*. Depends on G3.5's history, which is
why collection cannot be on-demand only.

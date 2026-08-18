# G7 · The consultant angle

These come from the fact that the user is a **consultant with multiple
clients**, and no tool in the field was designed for that. All of them feed on
data the other groups already produce.

## G7.1 ◐ Cost per workspace, splitting context from production `[meta]`

How much each client consumed, per project and per period. Verified in the log:
`input_tokens`, `cache_creation`, `cache_read`, `output_tokens` and
`thinking_tokens` per message — only a per-model price table is missing, since
the dollar value is not recorded. It is information you **bill**, and it is all
metadata, so it leaves the workspace without touching content.

And it is worth splitting in two: *most of the bill comes from context overhead
— system prompts and repo maps — not from the code the agent writes.* The
separate fields make the split exactly computable. It matters because
**overhead is optimisable** (smaller memory file, smaller scope) and written
code is not — without the split you cannot tell which one is costing you.

## G7.2 ◐ Decision record `[content]`

Every decision you took, with its context and the alternative chosen, becoming
a durable and searchable record. The queue already produces the data. It yields
consistency across projects, justification for the client ("why did we go this
way"), and context for a future session in the same repo.

It is the **only artefact of the product that compounds** — and, being the
memory of a stateless supervisor, it stops being a secondary feature.

Format: **shared with the architecture decisions, with promotion.** The queue
captures light decisions — context, what you chose, why — which is the
overwhelming majority. When a decision turns out to be architectural you
**promote** it to a full ADR: id, status, supersession, rejected alternatives,
and a mechanical refusal where one applies. Only promoted ones are read by the
architecture linter.

## G7.4 ★ The record feeds the next session `[content]`

Today G7.2 records decisions **for you**. The strong version: they become
context injected into that project's next sessions — *"this is how it was
decided here, and why"*.

That converts the record from a dead file into an **asset that compounds**:
each decision you take makes the next agent slightly less ignorant. And if it
is written into a shared agent-context file rather than a private format, it
works on any harness — serving harness independence for free.

## G7.5 ○ Handoff preparation `[content]`

At 60% of the window ([G3.9](G3-detection.md)), or when you stop for the day:
generate current state, decisions taken and next steps, with paths and commit
hashes. It is what stops the next session from starting cold.

## G7.6 ◐ Your time vs the agent's time `[meta]`

Session time is not your time. The product knows both: how long the agent ran,
and how long **you** spent in that workspace's queue. For billing a client the
second is usually the honest number — and it is the one nobody can measure
today.

## G7.7 ◐ Rework cost `[meta]`

How much was spent on work that was reverted, abandoned, or died on a branch.
It is the number that says whether the approach is paying, and the **only one
in the entire list that can tell you to stop**.

## G7.3 ◐ Report per workspace `[meta]`

What was done in workspace X this week: tasks, PRs, cost, time. Falls out free
of what G7.1 and G5.3 already collect.

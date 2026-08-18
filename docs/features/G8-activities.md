# G8 · Activities — the middle layer

The queue is reactive: the agent calls you. Activities are proactive: you
decide where to invest. **No tool in the field has the middle layer.**

## G8.1 ★ An activity is its own object, and it is not an issue `[meta]`

An activity is created **by you or by your agents, always** — nothing created
by another person. Issues and milestones are defined by managers and leads:
they are *assigned* work, and the product only mirrors them
([G5.3](G5-operating.md)).

The two coexist without synchronising because **they are not the same object**.
An activity may *reference* a tracker issue, and the reference is a pointer,
not a copy. That eliminates bidirectional sync, which is where this kind of
integration usually dies.

## G8.2 ★ Activities screen with its own chat `[meta]`

Where you manage your activities across all projects, with a chat to talk about
them — plan, order, decide where the week goes.

## G8.3 ★ Activities agent `[meta]`

Global, crosses workspaces, and **does not read project content**. It sees what
the rules engine exposes: status, age, cost, WIP, counts. It is the **fourth
actor** of the architecture.

Runs under a **configurable account** dedicated to the role, because it
receives filtered answers from every workspace.

## G8.4 ★ Mediated channel with the supervisors `[content, filtered]`

The activities agent asks the workspace supervisor in prose, and the supervisor
answers omitting what is sensitive.

⚠ **A model is the gatekeeper.** It is the risk that was rejected when the
`summary` export level was discarded, and it is being accepted here
deliberately, in exchange for usefulness — planning is conversation, and a
fixed catalogue always misses a question.

Chosen mitigation: **auditability instead of restriction.** Every question and
answer that crosses is logged and reviewable, and the answer carries its origin
when it appears in the UI — same logic as source citation
([G1.6](G1-deciding.md)). Transparency after the fact, since restriction before
the fact was refused.

## G8.5 ○ Triggers per activity `[meta]`

An activity declares what fires in each project when it advances — open a
session, call an agent profile ([G4.4](G4-automation.md)), open a PR. A
deterministic rule of yours, never an agent's decision.

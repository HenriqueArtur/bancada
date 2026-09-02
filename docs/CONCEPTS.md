# Concepts

The thesis, the vocabulary and the boundaries. Where an idea came from is in
[REFERENCES.md](REFERENCES.md); what gets built is in
[features/](features/README.md).

## Vocabulary

| Term | What it is |
|---|---|
| **project** | a body of content with work happening in it |
| **workspace** | confidentiality group — **the boundary** |
| **runtime** | where a session executes: local machine, VM, container, WSL, SSH |
| **account** | the credential that processes the content |
| **session** | one agent run doing the work |
| **rules engine** | global deterministic layer, **no AI** |
| **supervisor** | AI agent, **one per workspace** |
| **queue** | the decision queue — the main screen |
| **export level** | what a workspace lets out: `metadata` · `summary` · `full` |
| **silenced** | a project told not to ask — see below |

### Silenced

A project is **silenced** when you have told it not to ask for you. It stays
registered, stays read and stays openable; it simply contributes nothing to
the queue, the dock count or the notifications.

It is not "archived" and not "disabled". Both of those describe the project.
This describes **your attention**, which is the only thing this product
manages — the work in a silenced project may be going perfectly well, and you
have said you are not the one watching it.

Silencing records how many sessions the project had at that moment, and **a
session that did not exist then lifts it**. You silence a project when the
work there ends; a new session is new work, and a silence you have to remember
to lift is the forgetting the queue exists to prevent. See
[ADR-023](DECISIONS.md#adr-023--a-project-can-be-told-not-to-ask).

---

## Four different things called supervision

**1. Orchestration** (supervisor–worker). An agent that manages other agents:
decomposes, spawns workers, routes, respawns the dead. From Erlang's
supervision trees into every agent framework. **The supervisor decides; the
human leaves the loop.**

**2. Quality** (critic, judge). Evaluates a result, manages nobody.

**3. Process** (guardrail). A deterministic check fired by an event: a hook, a
policy, a test gate. Often not an agent at all. Where this fits instead of an
agent, use this.

**4. Attention** (triage). Watches N fronts and decides **what reaches you, in
what order and in what shape**. The human keeps deciding, but decides better
and about less.

**The target is #4.** It is the one almost nobody builds.

### Why #1 is the wrong one here

**It is client work.** "Should I restructure the client's database schema?" is
not delegable to a lieutenant — the decision is yours because the
responsibility is. An autonomous supervisor here does not reduce risk, it moves
risk somewhere you do not look.

**The goal is not to decide less, it is to decide better.** Those are opposite:
autonomous orchestration optimises for being interrupted less; this optimises
for the interruption being worth it and arriving with what you need in hand.

## #4, developed

Not a manager who decides for you — a chief of staff whose work product is
**your queue**. Five jobs:

- **Rank** — not "there is a pending question", but "this one is expensive to
  get wrong and has blocked you for 40 minutes; that one can wait".
- **Pre-digest** — you return to a project after 40 minutes elsewhere and have
  forgotten everything. Deliver, with the question: what happened since, why it
  is asking, what each option costs.
- **Group and suppress** — three permissions of the same shape are one item.
- **See the invisible** — fourth cycle of the same error; 300k tokens with no
  file changed; touched something outside scope. None of it becomes a question.
- **Give consistency** — you answered this in another project last week.

## Autonomy levels

Not a switch. Levels, chosen **per class of decision**, never globally.

| Level | What it does | Status |
|---|---|---|
| **L0** observer | Reads everything, writes nothing. | ✅ |
| **L1** advisor | Drafts the answer, requires your click. | ✅ |
| **L2** delegate | Acts on classes you pre-approved. | ✅ restricted |
| **L3** autonomous | Creates and supervises work. | ❌ **out** |

Vocabulary worth borrowing for L1: **approve as-is**, **reject and re-route**,
**edit the proposed action before executing**. The third is the most underused
— usually the answer is neither yes nor no, it is "yes, but change this path".

### The L2 exception: deciding that there is nothing to decide

The line is not between small and large decisions. It is between **deciding
about the work** and **establishing that nobody needs to be consulted**.
Telling a session to continue because it stopped only to report falls in the
second: it does not opine on the code, it verifies there is no pending
question. Approving a plan never falls there, however small the plan.

What is hard about the class is telling "stopped to report" from "actually
finished" — pure rules get it wrong, and it is the clearest case for AI
judgement.

---

## Principle: the product informs, you decide — nothing blocks

It emerged from four independent decisions that all landed the same way:
computed reach *reports, never prevents*; reviewability *warns, does not
block*; the WIP limit *confronts, does not block*; MCP state *shows, without
blocking*.

**The product never prevents an action of yours.** It measures, it shows, and
sometimes it adds friction — it never blocks.

Two reasons hold it up. A product that dictates workflow gets worked around on
the first urgent day, and then you lose the information along with the block.
And pretending to block creates a sense of guarantee that does not exist — the
product cannot actually prevent anything: whoever wants to opens a terminal.

The exception is what **the product writes**, not what you do: product memory
is not written by AI. That is not blocking you, it is the opposite.

---

## The model: four independent axes

```
Project
├── runtime    where it executes   local | vm:… | container:… | wsl:… | ssh:…
├── account    which credential    the account that processes the content
├── workspace  whose it is         the confidentiality boundary
└── repo       the content         code, documentation, or both
```

They coincide today by accident of one particular setup, and the coincidence
breaks in two real cases: a project running locally with no VM, and one runtime
hosting two workspaces.

The second forces a derived rule: **an account is shared; scope is not.** Two
workspaces may use the same credential; each supervisor invocation stays scoped
to **one** workspace even when the credential could reach more. Tightening a
workspace's regime later is then configuration, not architecture.

### A project is not necessarily code

`repo` is *content*, not *code*. A repository of only `.md` — a study, a
documentation base — is a project like any other. What it lacks is code
sessions.

What decides **which surfaces** a project has is what it declares, not what it
is.

---

## Isolation of what? — three things, and only one is ours

| # | Isolation of… | Who guarantees it | The product's role |
|---|---|---|---|
| 1 | **Execution** — what a session can open | the runtime boundary | inherits, reports |
| 2 | **Credential** — which account processes what | the harness config dir | inherits, reports |
| 3 | **Supervisor reading** — what the advisory AI sees | **the product** | **creates and governs** |

Item **3 is new in the world**. Before this product, nothing read two clients'
projects together. The supervisor is precisely an agent that crosses — a
capability the product invents and therefore must contain. The other two
existed without it.

**The `export level` governs only item 3.** Nothing else.

### Why an abstract badge was rejected

**A VM contains what is inside it but does not protect what is outside.** An
agent inside a VM cannot reach a directory that is not mounted; an agent
running on the host reads the mounted directory freely.

One direction is guaranteed and the other is not. `hard` would be a lie: hard
against agents in other VMs, null against local ones. **Direction matters, and
an adjective carries no direction.**

What replaces it is **computed reach** — the product knows where each project
lives and what each runtime mounts, so it calculates. A verifiable, actionable
fact: move the folder and the warning goes.

**It reports only, never prevents.**

### Export policy

Configured **on the workspace**; the project inherits. Few policies, many
projects.

The gain is not only maintenance: the question you answer when registering a
project becomes *"whose is this?"*, which is trivial and never wrong. If it
were *"what confidentiality level?"*, you could be wrong on autopilot, and the
error stays silent until it leaks.

**A new project is born at `metadata`.** It rises by deliberate act, never the
other way, never by default.

**`export level` = what the *other* workspaces' supervisors may read from this
one.** It is export permission, not import. The cross-workspace reasoning is
done by the **destination** workspace's supervisor, which may ingest from any
workspace that exports — with citation.

### A permissive mode is explicit in two layers

**State always visible** — workspaces above `metadata` appear in the UI chrome,
never buried in a settings screen.

**Citation at the moment of use** — every piece of advice that used another
workspace's content declares which one.

The citation is the layer that matters. The indicator warns about a *state*;
the citation warns about an *event* — the crossing happening now, not the
authorisation you granted three months ago and forgot.

---

## Anatomy: five actors

**1. Rules engine — one, global, no AI.** Not an agent: code. Reads metadata
from every workspace and produces the queue, the ranking, grouping, obvious
stagnation, WIP, cost and scope escape. **It has no account and no model** —
which is where the isolation conflict dissolves: there is no global model
reading everything, because the global thing is not a model.

**2. Supervisor — one per workspace, with that workspace's account.** This one
is AI. Two jobs: the periodic semantic check (only on sessions the rules
already flagged) and on-demand explanation (when you open a card). Reads
content.

**3. Sessions — the supervised work.** Each in its runtime, with its account.

**4. Activities agent — global, AI, no direct content access.** Lives in the
activities surface, crosses workspaces, helps plan the week. Reads what the
rules engine exposes and, for the rest, **asks** the workspace supervisor in
prose; the supervisor answers omitting what is sensitive. Runs under a
configurable account dedicated to the role.

**5. Doc agent — one per documentation, defined by it.** What distinguishes it:
**its definition lives in the content, not in the product.** Documentation
about ESP32 declares an ESP32 specialist; marketing documentation declares
another. The product carries the mechanism; the repository carries the
specialist — so when the repository is shared as a template, the specialist
travels with it.

### Two consequences that simplify the design

**The supervisor is an invocation, not a live process.** It does not sit
waiting: the rules engine calls it when there is reason, it answers, it dies.
No daemon lifecycle, no context growing forever, no stale supervisor.

**State lives in the record, not in a process.** Being stateless, its memory —
the "you decided something similar before" — comes from the decision record.
That promotes the record from secondary feature to **the supervisor's memory**.

### The fourth actor is the design's conscious concession

Everything else was built so that **no model guards a boundary**: the rules
engine has no model, the supervisor never leaves its workspace, and the
`summary` export level was discarded precisely because "a model decides what is
safe to summarise".

The activities agent's channel **breaks that deliberately**, in exchange for
usefulness: planning is conversation, and a fixed question catalogue always
misses one. The decision is conscious and the cost is named.

**Chosen mitigation: auditability instead of restriction.** Every question and
answer that crosses is logged and reviewable, and the answer carries its origin
when it appears in the UI.

---

## Rules detect, AI explains

| | Rules engine | Supervisor |
|---|---|---|
| When | always, continuous | on demand / periodic |
| On what | metadata | content |
| Where | outside the workspace | inside the workspace |
| Cost | zero | per use |

This split **coincides with the confidentiality boundary**: what is cheap and
continuous is what may leave the workspace; what needs content is what must
stay in. One boundary, two purposes.

Corollary: **hallucination never enters the ranking of your attention.** The
queue's order comes from rules. AI only writes the text you read after you
already decided to open the card.

### The third layer: semantic drift

Rules have a known blind spot — step caps and exact-repeat flags catch the
obvious cases and miss varied-argument loops and gradual drift. Rules catch
"same file 5×"; they do not catch "tried four different plausible approaches to
the same problem", which is the expensive kind of stuck.

Solution: a periodic semantic check inside the workspace, **only on sessions
the rules already flagged**. Cost where there is already reason to suspect.

---

## The ranking

```
score = decision kind × (age × project weight) × blocking
```

All deterministic, all in the rules engine, all over metadata.

**Weight answers "how fast does waiting hurt here"**, not "which project
matters more". Weight 3 means 20 minutes there weigh like 60 elsewhere. The
difference is not semantic: weight **scales time**, it does not override the
kind of decision.

That is what prevents the failure mode of a dominant priority tier — with a
dominant P0, a two-second permission on the P0 project outranks an architecture
choice stalled for two hours on P1. After the third time, you stop trusting the
order, and a queue you do not trust is a queue you ignore.

### Every number has a per-project default

Not just stagnation. In a large refactor a 5-hour session is normal and 900
lines of diff **is** expected — warning at 500 there is pure noise. Elsewhere 1
hour is already strange.

Inheritance follows the export level pattern: the workspace sets the default,
the project overrides.

### Preset, and calibration from history

Named presets give sane numbers with no configuration. A **calibrate** button
reads that project's session logs and proposes **measured** numbers instead of
guessed ones — possible only because the history already exists and is all
metadata.

> ⚠ **A learned baseline normalises dysfunction.** A project that lives with
> stuck sessions teaches the system that stuck is normal, and detection dies
> silently. So calibration is a **deliberate act with a visible result**, never
> continuous silent adaptation.

### The ranking must be explainable

Per-project weights and thresholds make the order opaque. The arithmetic is
available **on demand** — clicking an item opens the breakdown. It is cheap
because the arithmetic is already deterministic, and it is what sustains trust
in the queue, which is the whole product.

## WIP limit

**Unweighted.** Your attention is finite regardless of whose work it is: five
stalled items are five stalled items, from the most important client or the
weekend project. Weight orders the queue; it does not change your capacity.

It applies to the **queue**, not to running sessions. Six sessions working cost
you no attention; five stalled mean you became the bottleneck.

The queue is **per decision, grouped by session** in the display — a pending
question and a scope escape in the same session are two things, need two
actions, and neither may hide behind the other.

---

## The decision inventory

| Decision | Frequency | Expensive to get wrong? | What helps |
|---|---|---|---|
| Answer a structured question | medium | **yes** | restored context + cost of each option |
| Approve/deny a permission | high | almost never | group, learn the pattern, disappear |
| Approve a plan | low | **yes** | plan vs what was already done |
| Review a diff | high | yes | diff **against declared intent** |
| Choose where to work now | continuous | yes | ranking by cost of delay |
| Notice something derailed | — | **yes** | loop / stagnation detection |
| Open PR / merge | low | yes | CI state, scope touched |

Two rows became headline features:

**Diff against intent.** A raw diff is what you already have, and it is bad.
What exists nowhere: the diff beside what the session *said* it would do, with
the deviation marked. Turns review from "read 400 lines" into "look at the 3
places where it left the agreement".

**Stagnation detection.** The only one on the list you cannot do today at all,
with any amount of patience.

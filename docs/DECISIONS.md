# Decisions

Two tiers, with promotion.

**Light decisions** are the overwhelming majority: context, what was chosen,
why. They are captured as work happens.

**Promoted decisions** are the ones that would be re-proposed — by the next
person or by the next agent — if the reasoning were lost. They carry a full
record: status, supersession, rejected alternatives, and a mechanical refusal
where one applies. Only promoted ones are read by the architecture linter.

> The most valuable half of a decision is the part the code cannot show. The
> code shows that A was chosen; only the record shows that B was considered and
> why it lost.

---

# Promoted

## ADR-001 — Attention supervision, not orchestration

**status** accepted

**Decision.** The product supervises the human's attention, not the agents.
Autonomy levels L0–L2 only; **L3 is out of the product**.

**Why.** This is client work: the decisions are the user's because the
responsibility is. An autonomous supervisor does not reduce risk, it moves risk
somewhere nobody looks. And the goal was never to decide less — it was to
decide better, which is the opposite optimisation.

**Rejected**

- **Supervisor–worker orchestration** — the dominant pattern in every agent
  framework, and what the comparable tools in this space build. It removes the
  human from decisions the human wants to make.
- **Parallel panes with no supervision** — keeps the human in the loop and
  helps them not at all. Prettier terminals, same cognitive load.

**Named exception.** One L2 case: telling a session to continue when it stopped
only to report. The line is between *deciding about the work* and
*establishing that nobody needs to be consulted*.

## ADR-002 — The product informs, you decide; nothing blocks

**status** accepted

**Decision.** The product never prevents an action of the user's. It measures,
shows, and sometimes adds friction.

**Why.** A product that dictates workflow gets worked around on the first
urgent day — and then the information is lost along with the block. And
pretending to block creates a sense of guarantee that does not exist: whoever
wants to bypass it opens a terminal.

**Rejected**

- **Blocking on unsatisfied preconditions** — false confidence, and it gets
  disabled.
- **Hard limits on WIP, diff size or resources** — the same, plus it punishes
  legitimate work.

**Exception.** It governs what *the user* does, not what the product writes.
See ADR-005.

## ADR-003 — The workspace is the boundary, not the machine

**status** accepted

**Decision.** Confidentiality is grouped by `workspace`. A project declares
which workspace it belongs to. `runtime`, `account`, `workspace` and `repo` are
four independent axes.

**Why.** One runtime can host two workspaces, and one workspace can span
runtimes. Treating them as a single axis is the most likely source of a leak.

**Derived rule.** *An account is shared; scope is not.* Two workspaces may use
the same credential; each supervisor invocation stays scoped to one workspace
even when the credential reaches further.

**Rejected**

- **Runtime as the boundary** — breaks on the first local project and on the
  first runtime hosting two clients.
- **Per-project confidentiality settings** — with twelve projects you configure
  on autopilot, and the default decides instead of you.

## ADR-004 — The rules engine has no AI

**status** accepted
**enforced_by** crate boundaries · hard rule 2

**Decision.** The global layer that produces the queue, ranking, grouping,
stagnation, WIP and cost is deterministic code. It has no account and no model,
and reads only metadata.

**Why.** It dissolves the isolation conflict: there is no global model reading
everything, because the global thing is not a model. Corollary —
**hallucination never enters the ranking of the user's attention**.

**Rejected**

- **An AI agent doing the triage** — flexible, and it puts hallucination in the
  most dangerous possible place: the order of the attention queue.
- **Rules only, no AI anywhere** — loses pre-digestion, which is half the
  value, and cannot distinguish "finished" from "only reported".

## ADR-005 — A file is not memory

**status** accepted

**Decision.** An agent writes files freely. **Product memory is written only by
the product, on the user's action.** Where an agent must affect memory, it
proposes; the proposal becomes a queue item.

**Why.** Writing a file shows in a diff, passes review and reverts with `git`.
Writing memory does none of those, and it is what the supervisor reads later.
The distinction is not about who hallucinates — it is about what passes review.
This includes the supervisor: it is AI too.

**Rejected**

- **An MCP write channel straight into memory** — the record would feed itself,
  and unreviewed memory would accumulate generated content that degrades every
  future piece of advice.
- **Supervisor writes, sessions do not** — the supervisor is AI as well; the
  distinction does not hold.

## ADR-006 — A plugin returns data, never DOM

**status** accepted

**Decision.** A plugin returns typed contributions; the host renders them with
its own components. An isolated iframe is the escape hatch for custom views.

**Why.** **Sandbox by construction.** A plugin loaded in the webview sees
everything the webview sees, including the channel to the core, which talks to
every workspace — crossing every confidentiality boundary at once, through a
mechanism the product introduced. Serialisable data closes it. Side effects:
the theme becomes a structural guarantee, and the host framework stays
replaceable.

**Rejected**

- **HTML strings** (the previous contract) — stringly typed, no interactivity,
  and the theme guarantee depends on the plugin obeying documentation.
- **A component in the host's framework** — makes the framework a public API;
  swapping it breaks every plugin, and version skew is a known trap.
- **Web components** — framework-agnostic and interactive, but shadow DOM
  isolates styles in both directions and it does not solve the sandbox.

## ADR-007 — The product's MCP server runs over stdio, as a child of the harness

**status** accepted

**Decision.** Reads are free, writes are proposals only, and the transport is
stdio — the server is a child process of the harness, scoped to one session.

**Why.** No port, no network, no token: **containment by construction**. It
closes what was the only point where the boundary could leak through a
mechanism the product itself introduced.

**Rejected**

- **HTTP per workspace with an ephemeral token** — easier to reach from any
  runtime, but *anything* in that runtime reaches the server, not just the
  agent. Containment by policy, not by construction.
- **No MCP server at all** — context injection only serves what was
  anticipated; querying serves what was not.

## ADR-008 — Permission is a profile, not a mode

**status** accepted

**Decision.** A permission profile is a base mode plus allow/ask/deny lists by
tool pattern, inherited workspace → project → session. Switching context means
switching profile, not mode.

**Why.** A deny rule survives the most permissive base mode, while an allow
rule is inert under it. So the permissive mode the user actually runs can stay
exactly as it is **and still gate what is irreversible**. Because deny blocks
in *every* mode, a raw deny would also block deliberate infrastructure work —
hence named profiles.

**Rejected**

- **Mode per runtime** — leaves the real gap: inside one runtime, irreversible
  infrastructure work and ordinary code get identical treatment.
- **Mode chosen at session start** — requires predicting what the session will
  touch. A tool-class policy catches it when it happens.

**Named gap.** The permissive base mode disables a classifier whose one hard
deny is data exfiltration across a trust boundary. A runtime boundary stops
reaching *another* client's files; the classifier stops *this* client's code
going out. The runtime does not cover the second, because it has network. The
product shows the gap; it does not block.

## ADR-009 — Computed reach instead of an abstract badge

**status** accepted

**Decision.** For execution and credential isolation, the product computes and
reports actual reach between workspaces, rather than labelling each project
with a strength adjective.

**Why.** A runtime boundary contains what is inside it but does not protect
what is outside. One direction is guaranteed and the other is not, so an
adjective would be a lie — **direction matters, and an adjective carries no
direction**. Computed reach is verifiable and actionable: move the folder and
the warning goes.

**Rejected**

- **A `hard` / `soft` badge** — lies by omitting direction.
- **Formal workspace types** — resolves the symptom with a taxonomy; the
  computed fact resolves the cause.

## ADR-010 — Tauri, Rust core, React webview

**status** accepted

**Decision.** Tauri v2 for the shell, Rust for the core as its own binary,
React and TypeScript in the webview, Bun as the package manager for
development only.

**Why.** Everything reusable from prior work is presentation; everything new is
systems work — the split falls exactly where the toolchain boundary already is.
The Rust half is the half that changes least. The same Rust binary is the
daemon and the Linux MCP binary. Nothing JavaScript ships, so the package
manager's platform maturity never reaches production.

**Rejected**

- **Electron** — the weight lands exactly where this machine is already tight,
  and it would still end in a separate Node daemon.
- **Wails (Go)** — Go is a better fit for the concurrent half and
  cross-compiles beautifully, but v3 is in alpha and v2 is the previous
  generation.
- **Rust everywhere with a WASM frontend** — elegant, and it kills the plugin
  story: nobody writes a Rust plugin for a personal tool.
- **Elixir** — OTP supervises BEAM processes beautifully and OS processes
  awkwardly, and this product's core job is the second. Plus LiveView conflicts
  with a client-side plugin contract.
- **Svelte** — better shape fit for a live-updating queue, but the advantage is
  theoretical at 5–20 items, and the mature editor tooling matters twice.

---

# Settled

### Product and identity

- **Name: `bancada`, as a family.** The cockpit and the study viewer are two
  builds of one product.
- **Public repository**, with fixtures **recorded from a public repository** —
  a real session against public content, capturing the log. Real format, no
  client code. Better than sanitising (not safe) and than hand-written
  synthetic (does not capture the real format).
- **Product docs in English; the conversational record is not published.** The
  durable half is extracted; the record stays local.
- **Interface in English**, multi-language later.
- **Licence: MIT OR Apache-2.0.**
- **Monorepo**, Cargo workspace plus the app, the webview and the docs.

### The thesis

- **Queue is the spine:** per decision, grouped by session. Ranking =
  `kind × (age × weight) × blocking`, explainable on demand.
- **WIP limit on the queue, unweighted.** Defensible default: 2–4 parallel
  agents, diminishing returns beyond 5.
- **Four surfaces:** queue (now), activities (this week), project (the work),
  documentation (what is known).

### Boundaries and actors

- **Export level on the workspace, project inherits, born at `metadata`.**
- **A project is not necessarily code** — a repository of only `.md` is a
  project.
- **Five actors:** rules engine, supervisor (per workspace, an invocation not a
  live process), sessions, activities agent, doc agent.
- **The activities agent is the conscious concession**: a model guards that one
  boundary, mitigated by auditability rather than restriction. It runs under a
  configurable account dedicated to the role.
- **The doc agent's definition lives in the content**, so it travels when the
  repository is shared.

### Runtime, discovery, agents

- **Runtime is agnostic:** provider × instance, `fsAccess: shared | piped`.
  Reading from the host filesystem is a fast path, not the foundation.
- **Discovery proposes, you register.** Probe in a login shell.
- **Account identity is read, not typed.**
- **Cross-harness agents:** one canonical definition, compiled by the adapter.
  Identity compiles; capability comes over MCP; what does not map degrades out
  loud. Materialisation is ephemeral, never a file in a client repository.
- **SSH is a hypothesis:** interface ready, implementation deferred.

### Detection and operation

- **Rules detect, AI explains**, plus a third semantic-drift layer only on
  sessions already flagged.
- **Thresholds per project** (inherited from the workspace), with presets and
  calibration from history — a deliberate, visible act, because a learned
  baseline normalises dysfunction.
- **Resource thresholds per runtime** — a different axis.
- **Resources:** host and guest crossed; the metric is *overcommit*, because
  the guest's view is a lie.
- **The rules engine runs while a session is alive** — up with the first, down
  with the last.
- **Reviewability warns early, does not block.**
- **Multi-machine is out of v1**, but the model is keyed by machine from the
  start.
- **Worktree optional per project**, with the known cost of two code paths.

### Method

- **Spec-driven, in a light form of our own.** Four phases, no new toolchain.
- **A specification is worth writing when you would have written a prompt for
  it.** Below that, the commit message is the spec.
- **Only what cannot rot stays in prose.** Contracts are generated, acceptance
  criteria are tests, implementation detail is not written down.
- **Each rule descends as far as it can** — invariant, contract, test,
  procedure, intent. Only what no lower layer can hold rises to prose.
- **Architecture invariants are enforced, not documented.** Crate boundaries on
  the Rust side; an architecture linter on the TypeScript side.
- **The first code waits for the architecture linter's Rust support**, so the
  first line is born governed. The repository exists with the specification and
  no code — literally spec-first.

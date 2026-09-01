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

---

## ADR-013 · Exact versions everywhere, and bun is the only installer

**Status:** accepted · 2026-08-31

### Context

Two habits crept in while the first milestone was being built: `npm` was used
to add a package even though ADR-010 chose bun, and every dependency was
written as a range — `"react": "^19.0.0"`, `serde = "1"`.

Both are the same mistake wearing different clothes. A range says *some*
version in a family; a lockfile then picks one and pins it for this checkout
only. Anyone who runs `cargo add`, deletes a lockfile, or resolves the crate
as a dependency gets a different answer, and the difference shows up as a
failure nobody edited into existence. Two installers make it worse: `npm` and
`bun` write different lockfiles from the same manifest, and a repository
carrying both has two answers to "what version is this".

### Decision

**Exact versions, in both languages.** No `^`, no `~`, no bare major.

```jsonc
"react": "19.2.8"           // not "^19.0.0"
```
```toml
serde = { version = "=1.0.229", features = ["derive"] }   // not "1"
```

**bun is the only package manager.** `bun install`, `bun run`, `bun.lock`.
`package-lock.json` is in `.gitignore` so a stray `npm install` cannot leave a
second, disagreeing lockfile behind. Tauri's `beforeDevCommand` and
`beforeBuildCommand` call `bun`.

Upgrades are a deliberate commit that changes the number, with a name on it.

### Consequences

- A fresh clone, CI, and a contributor's machine resolve to the same bytes,
  lockfile or no lockfile.
- Security patches no longer arrive silently. That is the cost, and it is the
  point: a patch that lands without anyone choosing it is also a patch nobody
  tested. Dependabot-style bumps become reviewable pull requests.
- The pin is on the *direct* dependencies. Transitive versions still come
  from the lockfile — pinning the whole graph by hand would be fiction.
- `cargo update` becomes a no-op for pinned crates, which is the intended
  behaviour, not a bug to work around.

---

## ADR-014 · The machine bancada runs on registers itself

**Status:** accepted · 2026-08-31

### Context

Every runtime is a declaration. That is deliberate: discovery **proposes** and
registration is a human act, because forty containers found on a machine would
hide the three that matter (ADR-005, G6.9).

Applied without exception, the rule made the first five minutes absurd. To
watch a project on the very laptop the window was open on, you had to open a
JSON file and describe that laptop to the product — an empty prefix, an
identity path mapping, a shared filesystem — all of which the product could
only have gotten right.

### Decision

A runtime with the reserved id `this-machine` is **always present**, and is
never written to the configuration file.

```rust
RuntimeSpec::this_machine(home)   // prefix: [], roots: "/", configDir: $HOME/.claude
```

- `Config::parse_with_home` adds it **before** validation, so a project may
  name `this-machine` in a file that never mentions it.
- `Config::without_this_machine` removes it before writing. An entry somebody
  *edited* no longer equals the default and survives — which is the override.
- `$HOME` is read at the edge, beside the clock. Nothing in the core asks the
  environment.

### Consequences

- Registering a local project is one form and no file.
- The default cannot go stale, because it is recomputed every read rather than
  stored. Persisting it would freeze one `$HOME` into a file that outlives it,
  and the copy on disk would quietly win over the fact.
- The principle survives where it earns its keep. This is not discovery
  proposing something: the product is *already executing* there, so there is
  nothing to be wrong about. A VM, a container or a host reached over ssh is
  still a claim about somewhere else, and still has to be made by a person.
- Anyone whose harness keeps its state somewhere unusual writes an entry with
  that id and wins. A default that cannot be overridden is a default that
  eventually lies.

---

## ADR-015 · Warm paper, not a dark cockpit

**Status:** accepted · 2026-09-01 · supersedes the palette in G0.5

### Context

0.1 shipped a dark instrument-panel palette: near-black ground, cold greys, a
gold accent. The reasoning behind it was sound and survives — *at rest the
screen is empty, and colour is reserved for things that ask for an action, so
a colour appearing means one*.

The ground it sat on was wrong. A dark cockpit borrows its authority from
instrument panels, and this is not an instrument panel. It is a place you read
prose an agent wrote and decide whether you agree with it. Reading is what
happens here, for hours, and a black screen makes eight hours of it feel like
surveillance rather than like work.

### Decision

Warm paper. An earth palette — ivory, clay, sage, kraft — with one accent
spent sparingly, and a warm dark for people who read with the lights low. The
scarcity rule is unchanged: `--accent` means *this wants you* and appears
nowhere else.

Typography carries most of the change. A humanist serif (`ui-serif` — New York
on Apple, a transitional serif elsewhere) for headings and for quoted agent
prose; the system sans for interface text; a mono for paths and diffs. **No
web fonts:** the app must open with no network at all, and a font that arrives
late is a layout that moves under the reader.

Monaco gets the same palette. Its stock themes are cold, and a panel that does
not belong to the page around it reads as a different program embedded in this
one.

### Consequences

- Diffs read better: additions and removals are washes of sage and clay rather
  than saturated bands, so a hundred changed lines stop looking like an alarm.
- The serif does real work on the intent panel. What the agent claimed is
  quoted prose, and setting it as prose rather than as UI text is the whole
  argument of that screen made typographically.
- Light is now the primary design and dark the variant, which is the reverse
  of before. Both are defined completely; neither borrows from the other.
- G0.5 was closed as "dark cockpit". The issue's principle held and its
  palette did not, which is the ordinary way a design decision ages.

---

## ADR-016 · Five layers in the webview, enforced not agreed

**Status:** accepted · 2026-09-01

### Context

The webview grew as one folder of components and one root that knew
everything. It worked at nine files and stopped working at thirty: pages
reached into each other, spacing was chosen fresh at every call site, and the
only thing keeping a component reusable was whoever last edited it
remembering that it should be.

The Rust side never had this problem, because its boundaries are crates and a
crate that imports what it may not does not compile. The webview had the same
kinds of boundary and none of the enforcement.

### Decision

Five layers — `frame`, `components`, `composites`, `layouts`, `pages` — over
`core` (the seam to Rust) and `lib` (one helper). Everything is reusable
except `pages`, and nothing imports from `pages`.

**Raw HTML stops at `frame` and `components`.** Above them, every element is
a named thing from the design system. `archwarden`'s `chokepoint` rule with
`renders` makes this checkable, and it found twenty-two violations the first
time it ran — all mine, all written the same afternoon as the rule.

**Pages split reasoning from rendering.** `logic.ts` holds the hook and gets
the test; `view.tsx` arranges. The spec rule is scoped to the files that hold
reasoning rather than to every file, because eleven standing warnings is how a
real one gets missed.

**shadcn's idiom, our components.** Radix primitives, `cva` variants, `cn` for
merging — but the source lives in `components/` and archwarden governs it like
anything else. Radix earns its place on the parts that are invisible until
they are missing: focus trapped and restored, escape, scroll lock, aria.

**Tailwind v4**, build-time only, with the palette from ADR-015 as tokens. A
static stylesheet is what `default-src 'self'` requires anyway.

### Consequences

- Nine of the rules are proved to fire by `archwarden config verify-rules`.
  A layering nobody can violate by accident is worth more than a document
  nobody re-reads.
- A missing primitive is now a named addition instead of a `<div>`. That is
  slower per change and much faster per month.
- Settings became a dialog rather than a screen (ADR-017's shape, recorded
  here because the layering is what made it cheap): sections down the side,
  the queue still visible through the scrim.
- The two rules for `frame` and `core` verify as "not verified" — they only
  forbid imports, and a file that imports nothing cannot be told from one the
  rule does not cover. Named here so the gap is known rather than assumed
  closed.

---

## ADR-017 · A Rust file names what it exports

**Status:** accepted · 2026-09-01

### Context

The convention was there from the first crate and had never been written down.
Auditing the linter's own configuration is what surfaced it: two rules were
pointed at `crates/*/src/*`, which selects the *directories inside* `src`, of
which there are none. Both had been reporting nothing since the day they were
written, and both showed green.

### Decision

**A file names what it exports.** `session_state.rs` exports `SessionState`.
The rule now points at `crates/*/src` and passes on the tree as it stands.

Where the tests live is a separate decision, and a separate ADR: see
[ADR-021](#adr-021--rust-unit-tests-live-inside-the-file-they-test).

### Consequences

- The rule is live and green, which it had not been.
- The audit's real lesson is about the linter, not the rules:
  `archwarden check` passes on a rule that matches nothing, and only
  `config doctor` says so. It now runs in the gate list — and it is what
  caught this ADR bundling an enforced convention with an unenforceable one.

---

## ADR-018 · Inline styles are allowed, and nothing else is

**Status:** accepted · 2026-09-01

### Context

The webview shipped with `default-src 'self'` and nothing else, which is the
right instinct: no network, no CDN, no eval, everything from the bundle.

It also silently destroyed the file viewer. Monaco positions every single line
with a `style` attribute and injects its token colours as a `<style>` element
at runtime. Under the strict policy the lines stacked on top of one another,
nothing was coloured, and scrolling left holes in the text.

It took three rounds of *"it is still broken"* to find, and the reason is
worth recording: **a blocked style raises no error.** The tests passed, the
build passed, the dev server was perfect, and the production build served over
plain HTTP was perfect too. Only the packaged app was wrong, because only the
packaged app carries the policy.

### Decision

```
default-src 'self'; style-src 'self' 'unsafe-inline'
```

Nothing else moves. Script, connect, img and font stay on `default-src`, so
CSS still has nowhere to reach — the classic abuse of `'unsafe-inline'` styles
is exfiltration through `background: url(https://…)`, and that URL is refused
by a directive this change does not touch.

A test in the shell reads `tauri.conf.json` and asserts both halves: that the
loosening is there, and that it is still only this one.

### Consequences

- The file viewer works, in both themes, with the palette from ADR-015.
- Anything that renders through injected styles now works too, which includes
  most of what a future dependency will want. That is a genuine loss of
  strictness and the reason it is written down rather than merely committed.
- **The diagnostic loop is the lasting part.** The bug was invisible to every
  gate, so the fix was to reproduce the policy outside the app: serve the
  production build with the header attached and render it in headless Chrome.
  `web/probe/` builds with `PROBE=1`, and the difference between "works over
  HTTP" and "works under the app's CSP" is now one command apart.

---

## ADR-019 · Two surfaces: what needs you, and what you have

**Status:** accepted · 2026-09-01

### Context

A project with nothing waiting was invisible. The only way to reach one was
for it to have raised a decision, and the only way to confirm it was being
watched at all was to open settings — which shows the registration, not the
state. And the workspace, which ADR-003 calls *the* confidentiality boundary,
appeared nowhere in the interface except as a dropdown when registering.

Putting a project list on the cockpit was the obvious fix and the wrong one.
At rest that screen is empty, and everything on it means *act*. A list of
projects sitting beside the queue makes an empty cockpit stop being empty, and
the queue stop meaning anything.

### Decision

Two surfaces, from the four the plan already declared.

**Needs you** — the queue. Unchanged: empty at rest, everything on it an
action.

**Your work** — everything registered, grouped by workspace, each project
carrying whether it is alive: how many sessions, how long since the last one,
and how many decisions are waiting. Opening one goes where the queue's own
button goes.

The workspace is the **grouping**, not a label on each row, and it carries its
export level beside its name. A boundary rendered as a small word on three
separate cards is a boundary nobody checks; rendered as the thing that divides
the page, it is the first thing you see.

Workspaces can now be made, renamed and re-levelled in settings. Until this,
a fresh install could not register its first project without hand-editing
JSON, because a project must name a workspace and there was no way to make
one.

### Consequences

- The queue count on a project comes from the queue, not from a second
  computation. Two numbers derived two ways are two numbers that can disagree.
- Forgetting a workspace that still holds projects is refused, and the message
  names them. Cascading would forget the client work inside it, which is not
  what anybody means by removing a label.
- **A quiet project and an unreadable one no longer look alike.** That pair
  has been the product's blind spot three times now — in the queue, in the
  badge, and here — and it is the same mistake each time: silence used to mean
  two things.
- `Runtime` gained `modified`, which is how "last activity" is answered
  without reading a log. `None` rather than an error, because a runtime that
  cannot say and a file that was never written are the same answer to the only
  question anybody asks.
- Deliberately absent: pending diffs and machine resources per project. Both
  cost a process per project per open, and a screen you go to in order to find
  something has to be there before you finish deciding to look.

---

## ADR-020 · The palette and the language are choices, and a phrase is its own key

**Status:** accepted · 2026-09-01

### Context

Two settings that had never been settings: the window followed the system's
dark mode with no way to override it, and every string was English nailed into
the component that rendered it.

### Decision

**Three theme states, not two.** Light and dark are the ones people ask for;
*keep following the machine* is the third and it is the default. Applied
before the first paint — a window that corrects itself a frame later shows a
flash of the theme nobody chose — and the media query stays subscribed,
because "system" means keeps following.

**Both are kept in the webview, not in `config.json`.** The configuration is
the product's declaration of what it watches: projects, machines, boundaries.
A palette and a language are facts about whoever is reading, and mixing the
two puts a preference somewhere a backup or a shared configuration carries it.

**A phrase is its own key.** `t("Nothing needs you.")` looks the English up
and, finding nothing, returns what it was given.

- English needs no catalogue and can never be incomplete.
- The call site still reads as the sentence. This matters here more than
  usual: the interface text *is* the product's voice, and
  `t("cockpit.empty.headline")` hides it in a repository that spends its
  effort on code that reads like prose.
- A second language is one file. A phrase it lacks falls back to English *in
  place*, so a half-done translation shows the half it has rather than
  reverting the screen.

Rejected: a **typed catalogue with generated keys**, which gets completeness
from the compiler for free and would be genuinely safer — at the cost of
trading every sentence in the source for an identifier. **Lingui**, which
gets both, for a build macro in a Vite that has none. **i18next**, which is
right for ten languages and a translation team, and is machinery for a problem
two hundred phrases and one person do not have.

### Consequences

- The compiler cannot check completeness, so `bun run --cwd web text:check`
  extracts every phrase and diffs it against each catalogue. It joins the gate
  list. The tool proves it rather than anybody promising — the same move as
  `archwarden config verify-rules`.
- **Every phrase must be a literal inside a `t(…)`.** A phrase assembled at
  runtime is invisible to any extractor. Pure functions that produce text take
  the translator instead of returning a key: `label(kind, t)`. That is churn
  across the core, and it is what makes the check honest.
- The check fails on a **stale** phrase and not on a missing one. A catalogue
  carrying a phrase the source stopped saying is a translation of something
  nobody reads, and it hides that whatever replaced it is untranslated.
- Plurals are two literals chosen before the lookup. English and Portuguese
  both have two forms; a language with more needs this replaced, and that is
  written down rather than discovered.
- Portuguese ships registered and empty, and the interface says so — *0 of 174
  phrases*. The honest state, visible, rather than a language that silently
  does nothing.

---

## ADR-021 · Rust unit tests live inside the file they test

**Status:** accepted · 2026-09-01

### Context

Split out of ADR-017, which had bundled it with the naming rule because the
two arrived together. `config doctor` caught the bundling: one half is kept
by a rule and the other cannot be, and a decision marked unenforceable while
a rule enforces it is a decision nobody can reason about.

### Decision

`#[cfg(test)] mod tests`, in the file, not in a sibling. A test in the file
can reach the private function it is testing and moves with it when the file
moves — the half nobody remembers to check in review.

The webview does the opposite, with sibling `.spec.tsx` files, because
TypeScript gives it no other option. That is not an inconsistency worth
resolving; it is two languages with different tools for one intent.

`crates/*/src` is a unit test; `app/src-tauri/tests` is an integration test
and drives the commands against a real tree on disk. Both exist and they are
not the same thing.

### Consequences

- `rust/every-unit-carries-its-tests` was **deleted** rather than fixed.
  `spec-pair` looks for a sibling and no glob makes it fit an inline module.
  A rule that cannot be written is better absent than dead and green. Filed
  upstream as archwarden#178.
- **It costs a clean coverage number.** Assertion machinery — a fake's
  unreached arm, an `assert!`'s failure branch — sits in the measured file,
  and llvm-cov cannot tell it from product code. Two answers: shared doubles
  live in `bancada-testing`, which the report excludes by filename, and the
  gate reads lcov's `DA:` records rather than llvm-cov's own summary, because
  those are the source lines a person counts reading the file. With both, the
  five pure crates measure a literal hundred per cent.
- Narrow with `find_map(…).expect(…)` rather than `let … else { panic! }`.
  The failure arm then lives in `Option::expect`, in the standard library,
  instead of in a line no passing test ever reaches.

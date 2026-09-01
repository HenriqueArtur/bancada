# Architecture

Vocabulary and reasoning in [CONCEPTS.md](CONCEPTS.md). This file covers the
technical design only.

## Two models, at different levels

**The domain model** — a `project` has four independent attributes:

```
Project
├── runtime    where it executes   local | vm:… | container:… | wsl:… | ssh:…
├── account    which credential    the account that processes the content
├── workspace  whose it is         the confidentiality boundary
└── repo       the content         code, documentation, or both
```

**The code model** — two orthogonal abstractions:

- **Where does it run?** → `Runtime` (local, VM, container, WSL, SSH)
- **Which harness?** → `Adapter` (claude, codex, …)

```
┌──────────────────────────────────────────────────┐
│  WEBVIEW (React · TS)                            │
│  queue · diff · docs · terminal · plugins        │
└─────────────────────┬────────────────────────────┘
                      │ local WebSocket
┌─────────────────────┴────────────────────────────┐
│  CORE — own binary · Rust · no AI                │
│  queue · ranking · WIP · stagnation · cost       │
│  SQLite · git · computed reach                   │
└────┬──────────────────────────────────┬──────────┘
     │ via Adapter                      │ via Runtime
┌────┴───────────────────┐   ┌──────────┴────────────────┐
│ Adapter                │   │ Runtime                   │
│ claude │ codex │ …     │   │ local│vm│container│wsl│ssh│
│ observe:  session log  │   │ exec · spawn · pathMap    │
│ control:  stream JSON  │   └──────────┬────────────────┘
└────────────────────────┘   ┌──────────┴────────────────┐
                             │ SUPERVISOR (per workspace)│
                             │ invocation · AI · content │
                             │ headless run, its account │
                             └───────────────────────────┘
```

## Three hard rules

1. **Nothing above the adapter layer may import a harness-specific type.** If a
   harness's question type appears in the queue's code, harness independence is
   dead.
2. **The rules engine never reads content, only metadata.** If it needs to open
   a session log to read what was said, the confidentiality boundary is dead.
3. **The rules engine never calls `fs` directly**, only `Runtime.readFile` /
   `watch`. If it does, the `piped` path is born impossible and runtime
   agnosticism dies quietly.

These three are the highest-value candidates for mechanical enforcement: their
violation is silent and its consequence is a leak.

### How each is actually enforced

None of the three is enforced by the architecture linter, and that is not a
gap in it — `import-boundary` needs a resolver, which Rust does not have there
yet, and the crate-level half of what it would give is enforced better by the
toolchain anyway.

**Rule 1 — the crate graph.** `bancada-rules` does not declare
`bancada-adapter-*` in its `Cargo.toml`. The compiler refuses; there is nothing
to lint.

**Rule 2 — two event types, not one.** This one does not follow from the crate
graph on its own, and the reason is worth writing down: if the rules engine
receives `Event`, and `Event::Text` carries `content`, then the engine *can*
read content and only discipline stops it.

So the model splits:

```
bancada-meta     MetaEvent — kind, timing, counts, paths. No content field.
bancada-events   Event     — the full model. Depends on bancada-meta.
```

`bancada-rules` depends on `bancada-meta` and not on `bancada-events`. Reading
content stops being something the engine must avoid and becomes something it
cannot name. The adapter emits both; only the supervisor path carries the full
one.

**Rule 3 — clippy.** `std` is always linked, so "not depending on `std::fs`" is
not expressible as a dependency. `clippy.toml` carries `disallowed-methods` and
`disallowed-types`, scoped per crate through `[lints]`.

### The crate split that carries this

```
crates/
  bancada-meta        MetaEvent · no content, by construction
  bancada-events      Event · depends on meta
  bancada-runtime     Runtime trait and providers
  bancada-adapter-*   one per harness · depends on events
  bancada-rules       the rules engine · depends on meta only
  bancada-core        wiring, store, the daemon binary
  bancada-mcp         the MCP server binary
app/src-tauri         the shell
web/                  React + TypeScript
```

The split exists to make the rules mechanical. A crate boundary that is only
organisation can be moved; these three cannot, and a change that needs to move
one is a change that needs to revisit the rule.

### What the architecture linter carries instead

`arch.config.json` holds seven rules, and the valuable one is the first:

**The seam.** `invoke("…")` in the webview and `#[tauri::command]` in the shell
are the same edge, joined by a string that no import records. Neither cargo nor
`tsc` can see it, and nothing checks it until somebody clicks the button. It is
the only boundary here that needs a linter rather than a compiler.

The rest: tests beside every Rust unit, a file naming what it exports, the same
two for components, commands living in one folder, and the plugin boundary —
a plugin may not reach host internals, which is ADR-006 made mechanical.

Until code exists, `config doctor` reports every scope as matching nothing.
That is correct and expected: the config is part of the specification, written
before the tree it describes.

---

## Runtime

Two levels. It is easy to collapse them: a *provider* knows how to reach a
**class** of place; a *runtime* is **one concrete instance**.

```ts
interface RuntimeProvider {
  kind: "local" | "vm" | "container" | "wsl" | "ssh" | ...
  enumerate(): Promise<Candidate[]>        // proposes, does not register
  open(id: string): Runtime
}

interface Runtime {
  id: string
  kind: string
  exec(cmd: string[]): Promise<Result>
  spawn(cmd: string[]): Process
  readFile(path: string): Promise<Buffer>  // always here, never `fs` directly
  watch(path: string): AsyncIterable<Change>
  paths: PathMap
  fsAccess: "shared" | "piped"
}
```

### `fsAccess`

Reading the session log from the host filesystem is a **fast path**, not the
foundation. It exists when the harness config directory is visible from the
host. In a container without a bind mount, or over SSH, it does not.

| Runtime | Config dir visible from host? | How to observe |
|---|---|---|
| local | yes | fs events |
| VM with mount | yes | fs events |
| WSL | yes, via the distro share | fs events, slower |
| container with bind mount | yes | fs events |
| container without mount | no | tail through the exec pipe |
| SSH | no | pipe, or a helper on the far side |

`piped` is not impossible, it is more expensive. **Interface ready,
implementation deferred** — every runtime today is `shared`.

### Path translation

The host sees one path, the guest another, and the log records the **guest's**
— including in the project directory name, with slashes turned into dashes.

Every path that crosses must pass through the `PathMap`: paths inside events
and the `cwd` when starting a session. It is mechanical, but it rots if it
spreads. One `toHost()` / `toGuest()` and nobody touches a path string again.

**The directory name is computed, never decoded.** Recording showed the
encoding maps both `/` and `.` to `-`, so `a.b` and `a-b` collide. A project's
log directory is found by encoding a path the product already registered;
reading the name and reversing it would be a guess that is right most of the
time, which is the worst kind.

---

## Discovery

How the product knows a harness is there. The sequence is the same in every
runtime; only `exec` changes.

```
1. login shell: is the binary there? where?
2. version
3. authentication status
4. config dir → account identity
5. live sessions
6. where the logs are
```

Steps 3–6 are adapter-specific; 1 and 2 are generic. Each `Adapter` implements
its own `probe(runtime)`.

**Step 1 needs a login shell.** Binary paths vary per runtime and version
managers do not exist in a non-interactive shell.

**Discovers and proposes; you register.** Each provider enumerates candidates
and the product shows what it found. Automatic registration would be noise on
day one: forty containers hide the three that matter.

### Account identity

Step 4 is what turns the workspace boundary into something verifiable. The
harness config carries account uuid, email, display name, organization uuid,
organization name and role.

**The product reads; you map.** The machine knows *which account it is*; only
you know *whose work it is*. You answer one question — which workspace this
account belongs to — and never type a uuid.

Three things come free: the workspace↔account link becomes a **checkable
fact**; drift is detectable; and two runtimes sharing an `accountUuid` are
**visibly** sharing an account.

The config directory is self-contained: it carries the state and the identity.
Find the config dir, find everything.

---

## Adapter

```ts
interface Adapter {
  observe(session: SessionRef): AsyncIterable<Event>   // tail the log
  control(opts: SpawnOpts): Controlled                 // bidirectional process
  discover(runtime: Runtime): Promise<SessionRef[]>
  probe(runtime: Runtime): Promise<HarnessInfo | null>
}

interface Controlled {
  events: AsyncIterable<Event>
  send(input: UserInput): void      // text, question choice, permission
  interrupt(): void
}
```

### Normalised event model

The common denominator across harnesses. No harness-specific type in here:

```
TurnStarted    { sessionId, at }
Text           { role, content, partial? }
Thinking       { content }
ToolCall       { id, name, input, summary }
ToolResult     { id, ok, output }
Question       { id, prompt, header, options[], multi }
PermissionAsk  { id, tool, input, suggestions[] }
FileChanged    { path, kind }
TurnEnded      { cost, tokens, durationMs }
Error          { message, fatal }
```

`Question` covers a structured question, a plan approval, and whatever the
equivalent is in another harness. It carries options with label, description
and preview.

### Two modes, both needed

**Observe** — tail the session log. Works for **any** session, including ones
you started by hand in a terminal and ones already running. Read only.

**Control** — the product spawns the process and holds a bidirectional stream.
Receives every event and sends every answer. Only for sessions it started.

Observe is the universal floor: everything shows up in the queue, always,
including what you touch outside the product. Control is the upgrade for
sessions born inside it.

### Known fragility

The session log format is internal and undocumented. It can change between
harness versions. Contained in the adapter, tested against recorded fixtures,
and degrading gracefully — an unknown event becomes generic `Text` rather than
killing the tail.

---

## Plugin contract

A plugin returns **typed data**; the host renders. Never HTML, never DOM.

```ts
type Contribution =
  | { kind: "card";  title: string; rows: Row[]; actions?: Action[] }
  | { kind: "route"; path: string; title: string; content: Block[] }
  | { kind: "menu";  label: string; to: string }
  | { kind: "view";  entry: string }        // escape hatch: isolated iframe

interface Plugin {
  configure(cfg: unknown): void                    // fail early
  enrich?(input: T): T                             // piping, data → data
  cards?(ctx: Ctx): Contribution[]                 // collecting
  routes?(ctx: Ctx): Contribution[]
  menuItems?(ctx: Ctx): Contribution[]
  validate?(ctx: Ctx): Finding[]
}
```

### Why data and not DOM

**Sandbox by construction, and this is the main reason.** A plugin loaded
inside the webview sees everything the webview sees — including the channel to
the core, which talks to **every workspace**. A plugin with DOM and IPC access
crosses every confidentiality boundary at once, through a mechanism we
introduced. Serialisable data closes it: the contribution can be produced in a
worker or in the core, and never needs privileged access.

Same move as MCP over stdio — contain by construction rather than by policy.

**Theme becomes a guarantee, not a rule.** With no CSS and no HTML in the
plugin, the dark cockpit and the variable contract do not depend on anyone
following documentation.

**The host framework stays replaceable.** No plugin imports React, so swapping
React breaks no plugin. That is what makes the framework choice reversible.

### The escape hatch

`{ kind: "view", entry: "…" }` gives the plugin an **isolated iframe** with a
message channel. It exists because the extreme case is real: drawing a circuit
with a layout engine and third-party web components does not fit any card
schema.

Inside the iframe the plugin owns everything — and gives up the theme
guarantees in exchange. Three layers — declarative, programmatic, own view — is
the model that keeps large extension ecosystems visually consistent.

### Disciplines worth keeping

**Order is the contract** — a plugin declared later sees what the previous one
produced, without importing it. It is *cleaner* with data than with HTML:
typed structure down the pipe is far better defined than a string.

**Collecting vs piping** are distinct natures, and `collect()` is always async
— a caller forced to know which stages read files gets it wrong the first time
one starts to.

**The loader refuses** rather than guessing which export is the plugin.

---

## Agents across harnesses

There is **no cross-harness agent runtime**. "Agent" is a different thing in
each. What they share is a handful of primitives — name, description,
instructions, tool policy, model.

**1. Identity compiles to the native format.** The canonical definition lives
in the product; each adapter materialises it in its own shape. The agent
becomes a first-class citizen inside the harness.

**2. Capability comes over MCP.** MCP is the one cross-harness standard that
actually exists. A tool the agent needs and the harness lacks arrives there:
one implementation, every harness.

> The distinction must not blur: **MCP carries capability, not identity.**
> Exposing the whole agent as an MCP tool turns it into a black box — it loses
> subagent status and you lose the native UI.

**3. What does not map degrades out loud.**

```ts
Adapter.agentSupport = {
  subagent: boolean               // callable within a session?
  persona:  boolean               // can it define the whole session?
  tools:    "allowlist" | "mcp-only" | "none"
  model:    boolean
}
```

### Materialisation: ephemeral, never on disk

Everything is injectable when starting the session: the agent definition as
inline JSON, the MCP config as a string, an appended system prompt.

Nothing is written to disk. That matters for three reasons: the client's
repository gains no product files, a forgotten definition never lands in a PR,
and changing the definition takes effect on the next session with no migration.

### Where the definition lives

Global (yours, reusable) **and** declared by the project or the documentation
(travels with the repository). Project overrides global.

> ⚠ **An agent definition is content, and it has scope.** An agent whose prompt
> cites one client's conventions, used on another, **is a leak**. A global
> agent must be neutral.

### The product as an MCP server

Reads are free; writes are proposals only.

```
decisions.search(q)      the decision record
activities.list()        the activities
resources.status()       resource state
activities.propose(…)    the only write — lands pending, becomes a queue item
```

The gain: the agent **asks mid-session** — *"did we already decide something
about this?"* — instead of only receiving context injected at the start.
Injection serves what was anticipated; querying serves what was not.

**Transport: stdio, child of the harness, per session.** No port, no network,
no token — containment by construction. An HTTP server reachable from inside a
runtime would be reachable by *anything* in that runtime, not just the agent.

---

## Writing: a file is not memory

Two things with completely different risk.

| | Writing a **file** | Writing **product memory** |
|---|---|---|
| What | code, documentation, notes | decision record, activities, thresholds |
| Shows in a diff? | **yes** | no |
| Reviewed? | yes | no |
| Revertible? | `git` | no |
| Who reads it later | you, in the PR | **the supervisor**, as memory |

An agent editing a documentation file is doing its job, and the result is
reviewable. An agent writing to the decision record writes into **the
supervisor's memory**, unreviewed — poisoning the thing everything else depends
on, because the record exists to hold *your* decisions.

> **Rule:** an agent writes files freely; **memory is written only by the
> product, on your action.** Where an agent needs to affect memory it
> **proposes** — the proposal lands pending and becomes a cheap queue item.

This includes the supervisor: it is AI too. The distinction is not about who
hallucinates, it is about what passes review.

Corollary: the handoff and the injected context are **files** — written into
the repository or the notes, and therefore reviewable. They are not memory.

---

## Core

**Task** is the unit — not "session". A task may have several sessions: a
resume, a fork, a second attempt.

```
Task {
  id, title
  workspace, project, runtime
  repo, branch, worktree?
  status       → derived from the event stream
  sessions[]   → SessionRef
  tracker?     → external issue reference, read only
}
```

### Derived status

Status is not typed by you; it comes out of the event stream.

| Event | Status |
|---|---|
| `TurnStarted` | working |
| `Question` or `PermissionAsk` | **needs you** |
| `TurnEnded` with nothing pending | to review |
| `Error{fatal}` | broken |
| no event for N min with a live process | stalled? |

### Persistence

SQLite, only for what belongs to the product: tasks, board columns, the
task↔session link, the decision record. **Session logs are not duplicated** —
having two sources of truth about what the agent said invites divergence. The
product indexes; it does not copy.

---

## Stack

**Tauri v2 · Rust core · TypeScript webview · React · Bun as package manager.**

```
Bancada.app  (Tauri)
 ├── Rust    window · menu · tray · notification · updater
 │           spawns and supervises the core
 ├── core    own binary, Rust        ← the daemon
 │           adapter · runtime · rules engine · store
 │           the same code compiles to the Linux MCP binary
 └── webview React · TypeScript
             queue · diff · docs · terminal · plugins
```

### Why the core is a separate binary

Not preference, consequence: the rules engine **starts with the first session
and stops with the last**, independent of the window. That alone makes it a
process with its own life.

The same binary pays three things at once: it is the daemon, it is the **MCP
server running inside the runtime** (cross-compiled to Linux, no embedded
runtime), and it leaves the shell replaceable.

### Why Rust lands in the right half

The Rust half is the one that **changes least**: watching files, parsing logs,
spawning processes, measuring resources, ranking arithmetic. It stabilises
fast. What churns weekly — the queue, the ranking presentation, the surfaces,
the plugin contract — is TypeScript in the webview.

### Bun is never bundled

Bun is a **development** tool: dependency install and the frontend build. What
ships is a Rust binary plus static HTML/JS/CSS — **no JavaScript runtime
travels**.

Practical CI consequence: the frontend build is **platform-independent**.
Build once, on one runner, and every platform job consumes the same output.

| Piece | Choice | Note |
|---|---|---|
| Shell | Tauri v2 | installer, signing and updater ready on both OSs |
| Core / daemon | Rust, own binary | also the MCP binary, cross-compiled to Linux |
| Frontend | React + TypeScript | replaceable: no plugin touches the DOM |
| Packages | Bun | dev only; nothing JS is bundled |
| Realtime | local WebSocket (webview ↔ core) | |
| Diff | Monaco diff | same component as the file explorer |
| Terminal | xterm.js → PTY through `Runtime` | |
| Kanban | dnd-kit | not worth importing a whole board library |
| State | SQLite in the core | |
| Tracker | CLI via `Runtime.exec` | uses each runtime's credential, free |

### Two known caveats

**The system webview is two engines.** They diverge on CSS, fonts and media.
Test on both, not one.

**Monaco is heavy** (~5 MB). Load it on demand, when the explorer or the diff
opens — not in the queue's initial bundle, which is the screen that must open
fast.

---

## Out of scope

- **Autonomous orchestration (L3).** An agent creating and supervising work.
- **Multi-user.** It is a one-person cockpit.
- **Running in the cloud.** It runs on your machine.
- **Replacing the terminal.** The integrated terminal is an escape hatch.
- **Being a security tool.** Computed reach reports, it does not prevent.
- **Being a chat aggregator.** Editors already do that for free. If the product
  is only that, it is born redundant.

## Dependencies

Exact versions, both languages, no ranges — `"react": "19.2.8"`,
`serde = { version = "=1.0.229" }`. **bun** is the only package manager;
`package-lock.json` is ignored so a stray `npm install` cannot leave a second
lockfile that disagrees with `bun.lock`. See [ADR-013](DECISIONS.md#adr-013--exact-versions-everywhere-and-bun-is-the-only-installer).

```sh
bun install --cwd web      # frontend
bun install --cwd app      # the tauri cli
bun run --cwd web test     # vitest
cargo test --workspace     # rust
```

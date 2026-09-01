# bancada

A cockpit for supervising AI coding agents across clients, accounts and
machines.

Rust core · Tauri shell · React webview · MIT OR Apache-2.0

## The problem

Four terminals, each with an agent running, each on a different runtime, each
with a different client's account. Two pains, in the order they hurt:

1. **You cannot keep track.** You do not know, at a glance, which session is
   working, which is stalled waiting on an answer, and which finished ten
   minutes ago.
2. **You cannot review.** When it finishes, reviewing means a raw diff in a
   cramped terminal, with no memory of what the session said it would do.

The pain is *not* the lack of a pretty chat UI. That is the hardest part to
build and the one that least addresses the problem.

## What it is

An **attention supervisor**. Not an agent that manages other agents — a queue
that decides what reaches you, in what order and in what shape, so you keep
deciding but decide better and about less.

The screen that opens says what needs you right now, across every workspace
and every machine. Everything else is reached from an item in it.

## What works today

**0.1 · The cockpit** ships as a signed macOS app.

- **Needs you** — one queue across every registered project, per decision
  rather than per session, ranked by `kind × (age × weight) × blocking` and
  explainable on demand. Each row says what the decision actually is: the
  question that was asked, or `12 files changed · 3 unannounced`.
- **What changed** — the diff beside what the agent *said* it would do. Files
  nobody announced sort to the top. Marking one reviewed pins it to a
  fingerprint of its current diff, so the next edit reappears.
- **Files** — the project tree with a read-only editor, in the same palette
  as the rest.
- **Your work** — everything being watched, grouped by workspace, each project
  saying whether it is alive.
- **Settings** — register projects with a folder picker that answers *four
  sessions already recorded here* rather than printing an encoded path;
  describe other machines; probe them for a harness and an account.

It reads the harness's own logs and never writes to them. It runs entirely
offline: no network, no telemetry, no account of its own.

## What makes it different

The field converged on autonomous orchestration: agents supervising agents so
the human leaves the loop. This does the opposite — it keeps the human in the
loop and makes the loop cheap.

And nothing in the field is built for someone working across **multiple
clients with separate accounts**, where one client's code must never be
processed by another's credential. That constraint shapes the whole design.

Three properties fall out of it, and each is enforced rather than promised:

- **The rules engine has no AI and cannot see content.** Its event type has no
  variant that can hold any, so a leak is unrepresentable rather than
  forbidden — and a hallucination can never reach the order of your attention.
- **The workspace is the confidentiality boundary**, not the machine. A
  runtime can host two clients and a client can span runtimes.
- **A plugin returns typed data, never DOM.** A plugin loaded in the webview
  would see the channel to the core, which talks to every workspace.

## Building it

```sh
rustup toolchain install stable
bun install --cwd web
bun install --cwd app

bun run --cwd app build
open target/release/bundle/macos/bancada.app
```

macOS is the platform it is developed and shipped on today. The Rust core is
portable; Linux and Windows builds are planned.

## Pointing it at something

Registration is done in the window, under Settings. It writes
`~/.config/bancada/config.json`, which you can also edit by hand:

```jsonc
{
  "workspaces": [{ "id": "personal", "export": "metadata" }],
  "runtimes": [
    // The machine bancada runs on is always present and needs no entry.
    { "id": "devbox", "kind": "vm",
      "prefix": ["limactl", "shell", "devbox", "--"],
      "hostRoot": "/Users/you/dev", "guestRoot": "/mnt/dev",
      "configDir": "/Users/you/.devbox/state/devbox/claude",
      "sharedFs": true }
  ],
  "projects": [
    { "id": "thing", "workspace": "personal", "runtime": "devbox",
      "path": "/mnt/dev/thing", "weight": 3, "idleAfterMinutes": 2 }
  ]
}
```

`BANCADA_CONFIG` points it at a different one. The window says **not your
cockpit** whenever it is reading a configuration that is not the default.

There is a headless view of the same pipeline, useful when the window is not
the thing you are debugging:

```sh
cargo run -p bancada-core --example queue     # what needs you
cargo run -p bancada-core --example review    # the diff against the claim
cargo run -p bancada-core --example facts -- <log.jsonl> 20
```

## Working on it

```sh
make check      # rust · web · architecture, exactly as CI runs it
make help       # the rest
```

Architecture rules are enforced by [archwarden](https://github.com/HenriqueArtur/archwarden)
rather than agreed: layer boundaries, the seam to Rust, no raw HTML above the
design system's alphabet. Coverage floors are per area — pure logic at 100%,
the edge at 85%, arrangement exempt with its reason written down.

[AGENTS.md](AGENTS.md) is the working guide, [CONTRIBUTING.md](CONTRIBUTING.md)
the shape of a change.

## Roadmap

Milestones are stages in what the product *is* to you, not groupings of
related features.

| | | What you gain | |
|---|---|---|---|
| **0.1** | The cockpit | you **see** everything in one place | ✅ |
| **0.2** | Detection | it **tells you** what you could not have known | |
| **0.3** | Control | you **act here**, not in the terminal | |
| **0.4** | The supervisor | it **advises** — and the boundary arrives with it | |
| **0.5** | Memory | it **remembers** what you decided | |
| **0.6** | Agents and permissions | it **works with** your agents | |
| **0.7** | Documentation | the knowledge surface | |
| **0.8** | Activities | the middle layer | |
| **0.9** | The consultant | what you **bill** and what it cost | |
| **1.0** | Satisfied | the bar, with no scope of its own | |

Two properties of that order are deliberate.

**0.1 and 0.2 carry no AI at all.** All 24 features in them are rules over
metadata plus rendering. The product becomes genuinely useful before any model
is involved, before any account processes anything, and before any isolation
apparatus needs to exist — because nothing crosses.

**0.4 is where AI and the confidentiality boundary arrive together.** Export
levels, computed reach, account identity and source citation guard nothing
until a model reads content. Building them earlier would be a gate on a door
nobody walks through; building them later would be walking through with no
gate. It is the one ordering in the plan that is not negotiable.

## Documentation

| | |
|---|---|
| [CONCEPTS.md](docs/CONCEPTS.md) | **Start here.** The thesis, vocabulary, boundaries, the five actors |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical design, contracts, stack |
| [FRONTEND.md](docs/FRONTEND.md) | The five webview layers and the design system |
| [TESTING.md](docs/TESTING.md) | Coverage floors, and what is exempt from them |
| [DECISIONS.md](docs/DECISIONS.md) | What was decided, and what was rejected and why |
| [features/](docs/features/README.md) | 77 features in ten groups, marked and scoped |
| [REFERENCES.md](docs/REFERENCES.md) | Every source that shaped a decision |
| [RISKS.md](docs/RISKS.md) | What is known to be dangerous |
| [specs/](docs/specs/) | Per-unit specifications |

## Licence

MIT OR Apache-2.0.

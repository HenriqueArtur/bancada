# bancada

A cockpit for supervising AI coding agents across clients, accounts and
machines.

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

The screen that opens says what needs you right now, across every workspace and
every machine. Everything else is reached from an item in it.

## What makes it different

The field converged on autonomous orchestration: agents supervising agents so
the human leaves the loop. This does the opposite — it keeps the human in the
loop and makes the loop cheap.

And nothing in the field is built for someone working across **multiple
clients with separate accounts**, where one client's code must never be
processed by another's credential. That constraint shapes the whole design.

## Roadmap

Milestones are stages in what the product *is* to you, not groupings of
related features.

| | | What you gain |
|---|---|---|
| **0.1** | The cockpit | you **see** everything in one place |
| **0.2** | Detection | it **tells you** what you could not have known |
| **0.3** | Control | you **act here**, not in the terminal |
| **0.4** | The supervisor | it **advises** — and the boundary arrives with it |
| **0.5** | Memory | it **remembers** what you decided |
| **0.6** | Agents and permissions | it **works with** your agents |
| **0.7** | Documentation | the knowledge surface |
| **0.8** | Activities | the middle layer |
| **0.9** | The consultant | what you **bill** and what it cost |
| **1.0** | Satisfied | the bar, with no scope of its own |

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
| [features/](docs/features/README.md) | 77 features in ten groups, marked and scoped |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical design, contracts, stack |
| [DECISIONS.md](docs/DECISIONS.md) | What was decided, and what was rejected and why |
| [REFERENCES.md](docs/REFERENCES.md) | Every source that shaped a decision |
| [RISKS.md](docs/RISKS.md) | What is known to be dangerous |
| [SPIKES.md](docs/SPIKES.md) | Ordered, with what 0.1 needs at the top |
| [specs/](docs/specs/) | Per-unit specifications |

## Status

Specification complete, no code. That is deliberate: the first line of code
waits for the architecture linter to support Rust, so it is born governed.

## Licence

MIT OR Apache-2.0.

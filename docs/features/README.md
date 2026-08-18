# Features

Ten groups, 77 features. The order is thematic, not chronological — see
[../DECISIONS.md](../DECISIONS.md) for the first slice.

## Legend

- ★ **signature** — nobody in the field does this; it is why the product exists
- ○ **table stakes** — everyone does it; you need it, it does not differentiate
- ◐ **beyond** — new idea, from the discussion or from research

Every feature declares which side of the confidentiality boundary it lives on:

- `[meta]` — runs in the **rules engine**, outside the workspace, on metadata
- `[content]` — runs in the **supervisor**, inside the workspace

This is a constraint, not an observation. A `[meta]` feature that turns out to
need content is a feature that was designed wrong.

> The interface ships in English. Labels here are descriptions, not final
> strings.

## Groups

| | Group | What it answers |
|---|---|---|
| [G0](G0-queue.md) | The queue | what needs me right now |
| [G1](G1-deciding.md) | Deciding well | what this decision costs |
| [G2](G2-reviewing.md) | Reviewing | what actually changed |
| [G3](G3-detection.md) | Seeing what you would not | what is going wrong quietly |
| [G4](G4-automation.md) | Automating non-decisions | what needs no human |
| [G5](G5-operating.md) | Operating | doing the work |
| [G6](G6-governance.md) | Governance | who may see and do what |
| [G7](G7-consultant.md) | The consultant angle | what the field ignores |
| [G8](G8-activities.md) | Activities | what I committed to this week |
| [G9](G9-documentation.md) | Documentation | what is known about a project |

## Four surfaces, three of them time horizons

| | Answers |
|---|---|
| **queue** | what needs me **right now** |
| **activities** | what I committed to **this week** |
| **project** | the work **happening** |
| **documentation** | what is **known** about the project |

## Deferred, not cut

- **G9.6** — standalone Windows viewer
- **G2.4** — step graph

## A note on the marks

43 of 77 are marked ★. If more than half is a differentiator, nothing is —
the marking is loose and deserves a pass before these become issues.

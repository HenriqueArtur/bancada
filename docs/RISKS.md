# Risks

## Scope

77 features. Slicing is the defence; the discipline is the user's.

## The ★ marking is loose

43 of 77 are marked as signature. If more than half is a differentiator,
nothing is. Worth a pass before features become issues, otherwise the
prioritisation inherits a broken scale.

## The session log format is internal

Undocumented, and it changes between harness versions. Contained in the
adapter, tested against recorded fixtures, degrading gracefully. The fixture
recorder doubles as a **format regression detector**: re-record after a harness
update and the diff shows what changed, before it breaks in production.

## A model guards the activities channel

The one boundary guarded by judgement rather than by mechanism, accepted with
open eyes in exchange for usefulness. It is logged and auditable — but a log
only helps if someone reads it. Worth defining when and how it gets reviewed,
or the record becomes theatre.

## `is_error` does not mean the thing failed

Recorded and verified: a shell command exiting 127 produced a tool result with
`is_error: false`. The flag marks the *tool* erroring, not the command. The
exit code lives in the result's content.

The consequence is on G3.1: "the same command failing repeatedly" cannot be
detected from metadata as the format stands. The fix is for the adapter — the
one place allowed to read content and emit metadata — to distil an exit code
into a fact. Not a relaxation of the boundary, a use of the layer that exists
to cross it safely.

## Optional worktrees mean two code paths

Everything that touches files — diff, terminal, tracker, cleanup — must work in
both modes, and the less-used one breaks unnoticed. Test both from the start.

## Sequencing between the two projects

The first code waits for the architecture linter's Rust support, which puts it
on the critical path. Same maintainer for both, so it is not third-party risk —
it is ordering risk. Cheap defence: **size the Rust parser to the rules this
project needs**, not to parity with the existing language support.

## Tool deformation

Two projects of the same author growing together invites building features in
the linter *for* this product that do not generalise. That is how a good tool
bends. The linter's own README carries the defence — every rule it ships must
be something no other mainstream tool does well — and it deserves to be applied
against its own sibling.

## A permission surface not yet confirmed

Intercepting permission prompts in the product's UI is not confirmed on the
installed harness version. The likely path is the agent SDK's tool-permission
callback. It does not block 0.1 or 0.2, which carry no AI.

## Machine resources — an operational finding, not a feature

Measured 2026-08-14, on the machine this was designed on:

```
host          27 GiB free · 88% full
runtime A     19 G of 30 G thin-provisioned
runtime B    6.3 G of 30 G thin-provisioned

guests together believe they can write ~33 G
```

The ceiling is 60 G against 27 GiB actually available. Plus **swap 0B** with
3.8 GiB per guest: no degradation, the OOM killer fires immediately.

This is the concrete case behind G3.5 and G3.6, and it is worth addressing
independently of this project.

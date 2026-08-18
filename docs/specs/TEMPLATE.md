# NNNN — <title>

> Copy this file, number it, and delete the guidance lines.
> A spec is worth writing when you would have written a prompt for it.
> Below that threshold, the commit message is the spec.

**status** draft | in progress | done
**features** G0.1, G0.3
**decisions** ADR-004

## Intent

One paragraph. What this is and why it exists — not how. This is the part that
does not rot: it stays true when the code changes.

## Contract

Types in, types out. Where a shared type crosses the Rust ↔ TypeScript
boundary, name it here and generate it; do not restate it in prose.

## Acceptance criteria

Numbered, testable statements. **These become test names.** If a criterion
cannot be phrased as something a test asserts, it belongs in Intent instead.

1. Given …, when …, then …
2. …

## Out of scope

Explicit. What a reasonable reader would assume is included and is not.

## Open

What is still unknown. An empty section is a good sign; a spec written with
unknowns hidden is worse than one that names them.

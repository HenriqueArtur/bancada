# The frontend

Five layers, each one reusable except the last, with the boundaries between
them enforced by `archwarden` rather than by care. See
[ADR-016](DECISIONS.md#adr-016--five-layers-in-the-webview-enforced-not-agreed)
for why they exist and [ADR-015](DECISIONS.md#adr-015--warm-paper-not-a-dark-cockpit)
for what they are painted in.

```
web/src/
  lib/          cn — the one styling helper
  core/         the seam to Rust, and the pure functions over it
  frame/        how things sit: Stack, Row, Grid, Inset, Page, Split, Listing
  components/   what things are: Button, Card, Input, Select, Dialog, Text…
  composites/   parts that are always several components at once
  layouts/      where things go on a screen, knowing nothing about them
  pages/        one folder per screen — the only layer that is not reusable
    _shared/    what more than one page needs and no page owns
```

## What each layer may do

| Layer | May import | Raw HTML |
|---|---|---|
| `core` | `core`, `lib` | — |
| `frame` | `frame`, `lib` | **yes** |
| `components` | `components`, `frame`, `lib` | **yes** |
| `composites` | `components`, `frame`, `core` types, `lib` | no |
| `layouts` | `composites`, `components`, `frame`, `lib` | no |
| `pages` | everything below | no |

Nothing imports from `pages`. Anything that tries is trying to reuse a page,
and what it wants belongs a layer down or in `pages/_shared`.

### Raw HTML stops at the alphabet

`<div className="flex gap-4">` in a page is a design decision made outside the
design system. Consistency erodes one of those at a time, none of them wrong
on its own, and by the time it is visible it is a hundred edits deep.

So `frame` and `components` are the only files allowed to render intrinsic
elements. Everything above composes from what is there — or adds to it, which
is the point: the missing piece becomes a named thing everyone gets.

`archwarden`'s `chokepoint` rule with `renders` enforces this. It found
twenty-two violations the first time it ran, all of them mine, all written the
same afternoon I wrote the rule.

## Pages separate reasoning from rendering

```
pages/cockpit/
  logic.ts        the polling, the diffing of newcomers, the error handling
  logic.spec.ts   tested with `renderHook`, no DOM in the way
  view.tsx        arrangement only
  group.tsx       parts belonging to this screen alone
  score.tsx
```

`logic.ts` is where a hook lives and where a test can reach it. A view is
arrangement, and arrangement is checked by looking — the spec rule is scoped
to the files that hold reasoning, because a rule that warned about every view
would be eleven warnings nobody reads, which is how a real one gets missed.

## The design system

**Tokens, never hex.** Every colour is a CSS variable in `theme.css`, exposed
to Tailwind through `@theme inline`. A hex code anywhere else is a decision
made in the dark, and the eighth one is always slightly off.

**Clay is scarce.** `--clay` means *this wants you*. One primary button per
screen; a screen with two has already lost the meaning.

**Named spacing.** `gap="snug"` rather than `gap-3`. A number is a value
somebody chose once; a name is a decision the whole product can make the same
way. Six steps, and nobody has needed a seventh.

**Serif for reading, sans for interface.** Headings and quoted agent prose are
set in the serif — a claim you are asked to hold a diff against is reading
matter. No web fonts: the app must open with no network at all, and a font
that arrives late is a layout that moves under the reader.

## Libraries

- **shadcn/ui idiom** — Radix primitives, `cva` for variants, `cn` for merging.
  The components are ours, in `components/`, and archwarden governs them like
  anything else.
- **Radix** for the parts that are invisible until they are missing: focus
  trapped in the dialog, focus restored on close, escape, scroll lock, aria.
- **Phosphor** for icons, at `regular` weight. Rounded joins, six weights, and
  it sits beside a serif without looking like a control panel.
- **Tailwind v4** through `@tailwindcss/vite`. Build-time only: the output is
  a static stylesheet, which is what `default-src 'self'` requires.

## Commands

```sh
bun install --cwd web
bun run --cwd web test      # vitest
bun run --cwd web build     # tsc -b && vite build
bunx --bun archwarden@latest check
```

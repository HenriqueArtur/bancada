# Contributing

Thank you for looking. This is a personal tool built in the open, so the bar
is not "does it work" — it is "will the next person understand why".

## Before you write anything

**Ask whether it has already been decided.** The repository keeps its
decisions with the options that lost, and the linter can search them:

```sh
bun add -g archwarden@0.35.0
archwarden decisions find electron
```

If your idea is in there under a different name, the reason it lost is there
too — and it may be a reason that has stopped being true, which is a much
better pull request than the idea on its own.

**Open an issue first for anything that changes a decision, adds a
dependency, or touches the confidentiality boundary.** Small fixes need no
ceremony.

## The shape of a change

```sh
git switch -c what-it-does
make check        # rust · web · architecture, exactly as CI runs it
```

Nothing goes straight to `main`, including fixes to CI itself. Open a pull
request and let the four jobs run: `rust`, `web`, `architecture`, and one that
builds the desktop bundle because the tests never open a window.

`make check` is the whole gate. If it is green locally the pull request will
be. If it is red, nothing else matters yet.

## What the gate holds you to

- **Coverage floors per area**, not one figure for the repository. Pure logic
  is at 100%; the edge that touches a filesystem or a clock is at 85%;
  arrangement is exempt with its reason written beside it. See
  [docs/TESTING.md](docs/TESTING.md).
- **Architecture rules**, enforced rather than agreed. `archwarden check`
  refuses a page that imports another page, a layout that fetches, raw HTML
  above the design system's alphabet. Run `archwarden describe <path>` to ask
  what is required of a file before you write it.
- **Exact versions**, in every manifest, in both languages. No `^`, no `~`.
  `bun` is the only package manager for the JavaScript side.
- **No untranslated string.** Interface text goes through `t("…")` as a
  literal; `make text` proves nothing was missed.

## Commit messages

Gitmoji, a subject that says what changed, then prose about **why**.

The diff already lists the files. What it cannot show is what was considered
and dropped, what the change protects against, and what went wrong on the way
— all three belong in the message. Mistakes are written down plainly; they are
the most useful part six months later.

## Pull requests

Say what the change is for and what you decided against. A reviewer can read
the diff; what they cannot read is the option you tried first.

If the change is visual, include a picture. `tools/look.sh` renders a
component with headless Chrome and needs no screen:

```sh
bun run --cwd web dev --port 5199 &
tools/look.sh out.png "?light&work"
```

## Getting set up

```sh
rustup toolchain install stable
bun install --cwd web
bun install --cwd app
bun add -g archwarden@0.35.0

make check
bun run --cwd app build && open target/release/bundle/macos/Bancada.app
```

macOS is the platform the product is developed and shipped on today. The Rust
core is portable and the Linux and Windows builds are planned; if you are on
one of those and something does not build, that is a bug worth an issue.

## What this project will not do

Some things are decided and the argument is written down. A pull request that
reverses one needs to argue with the record, not around it:

- **It supervises attention, not agents.** No orchestration, no autonomy that
  takes a decision from the person responsible for it. (ADR-001)
- **It informs; it does not block.** No hard limits, no preconditions that
  refuse to proceed. (ADR-002)
- **The rules engine has no AI and sees no content.** The queue's order is
  produced by deterministic code reading metadata, so a hallucination can
  never reach the order of somebody's attention. (ADR-004)

[docs/DECISIONS.md](docs/DECISIONS.md) has the rest, each with the options it
rejected.

## Licence

MIT OR Apache-2.0. By contributing you agree your work is offered under both.

# Working in bancada

An attention supervisor for AI coding agents. What it *is* lives in
[README.md](README.md); this is how to work on it.

Read by whichever harness you use: `CLAUDE.md` is a symlink to this file, so
there is one set of instructions and no chance of two drifting apart.

Everything here is something no other file carries. Architecture, decisions
and rules have owners, and a rule written twice goes stale in one of the two
places — so this points rather than repeats.

## The gate

```sh
make check      # rust · web · architecture, exactly as CI runs it
make help       # the rest
```

CI calls these same targets. If `make check` is green the pull request will
be, and if it is red nothing else matters yet.

**Read a gate's own output, never a filter over it.** `make test | grep -c ok`
succeeds when the grep finds a failure, and a commit went out red that way.

## Branch, then pull request

Nothing goes straight to `main`. Branch, commit, open a pull request, wait for
the four jobs. That includes fixes *to* CI — a one-line workflow change is
exactly the case the rule exists for.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rest of the shape.

## Where the truth is

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | the crates, the seam, the hard rules |
| [docs/FRONTEND.md](docs/FRONTEND.md) | the five webview layers and the design system |
| [docs/TESTING.md](docs/TESTING.md) | coverage floors, and what is exempt from them |
| [docs/DECISIONS.md](docs/DECISIONS.md) | the argument behind each ADR |
| [docs/CONCEPTS.md](docs/CONCEPTS.md) | the vocabulary — workspace, runtime, project, session |

## Ask archwarden before proposing

The linter is not only a check; it answers questions.

```sh
archwarden agent-guide                    # every rule and decision, generated
archwarden decisions find electron        # has this already been rejected?
archwarden describe web/src/pages/x.tsx   # what is required of a path
archwarden scaffold web/src/components/y  # the smallest shape that satisfies it
```

`decisions find` is the one worth reaching for. The ADRs exist because
decisions get re-proposed, and whoever is about to re-propose one does not
know its id and will name the option differently from whoever rejected it.

A pre-write hook is installed in `.claude/settings.json`: a write that would
break a rule is refused before it lands, rather than found twenty files later.
It needs `archwarden` on `PATH` — `bun add -g archwarden@0.35.0`.

## The voice

The repository is written in English: code, comments, documentation, commits,
issues and pull requests.

**Commit messages are gitmoji and a subject that says what changed, then prose
about *why*.** Not a changelog of files — the diff already has those. What the
diff cannot show is what was considered and dropped, and what the change
protects against. Mistakes go in too, named plainly.

**Comments explain the decision, not the mechanism.** `// increment the
counter` is noise; *why* the counter cannot be a `usize` is the comment. If a
line looks wrong and is right, say why it is right.

Interface text is prose and carries the product's voice. It is capitalised
like sentences, and it goes through `t("…")` as a literal — see
[docs/FRONTEND.md](docs/FRONTEND.md#language).

## Seeing the interface

The product is a desktop window, and an agent usually cannot take a
screenshot of one. To look at something:

```sh
bun run --cwd web dev --port 5199 &
tools/look.sh out.png "?light&work"
```

`web/probe/` mounts the real components without the shell, and
`tools/look.sh` renders it with headless Chrome. It has caught six bugs that
reading the code did not — including a licence file rendering as one line and
an editor wearing two palettes at once.

To see the packaged window instead:

```sh
bun run --cwd app build && open target/release/bundle/macos/bancada.app
tools/test-cockpit.sh                     # against a scratch configuration
```

## Two habits worth keeping

**Pin everything, including the tools.** ADR-013 says exact versions in every
manifest; `archwarden@latest` in a Makefile is the same mistake in the place
it does the most damage.

**Reproduce before fixing.** The file viewer took three rounds because the bug
only existed under the packaged app's content security policy — the dev server
and the production build over plain HTTP were both perfect. Serving `dist`
with the app's own CSP header reproduced it on the first try.

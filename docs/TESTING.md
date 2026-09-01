# Testing

One command, and CI calls the same one.

```sh
make check          # everything, the way CI runs it
make rust           # fmt · clippy · test · coverage
make web            # biome · tsc · phrases · test · coverage
make arch           # archwarden check · config doctor
```

`make help` lists the rest. A pipeline that spells the checks out a second
time drifts from the first on the day somebody adds a step to only one of
them, and nobody notices until the thing it was guarding breaks — so the
workflow calls these targets and states nothing of its own.

## What gets tested, and what does not

**Logic always. Interface only where it decides something.**

| | Floor | Why |
|---|---|---|
| `crates/*` except runtime | **100%** | Pure. Same input, same answer, nothing about the machine can change it. An uncovered line is a branch nobody has ever run. |
| `web/src/core`, `web/src/lib`, `pages/**/logic.ts` | **100%** | The same, on the other side. |
| `crates/bancada-runtime`, `app/src-tauri` | **85%** | The edge: a filesystem, a clock, a process. A percentage over `std::fs` is a floor against rot, not a claim about quality. |
| `web/src/**` — components, composites, page parts | **85%** | Anything that chooses: a variant, an order, a plural, a branch, what gets marked. |
| `frame/`, `layouts/`, `**/view.tsx`, `app.tsx`, `main.tsx`, barrels | — | Pure arrangement. Checked by looking, and `web/probe/` exists for that. |
| `attention.rs`, `lib.rs`, `main.rs` | — | Only the operating system. Every decision behind them is in `core/attention.ts`, which is at a hundred. |
| `crates/bancada-testing` | — | The ladder, not the building. |

Per area, never one figure for the repository: a single number lets a module
at nought hide behind a module at a hundred while the average climbs.

Every exclusion carries its reason in `tools/coverage-gate.py`. An exclusion
nobody can argue with is one that spreads.

## Why lcov and not the summary

`llvm-cov`'s own summary counts more lines than the file has — macro
expansions, the closing brace of a function that always returns early — and
disagrees with what a person sees reading the code. The gate reads lcov's
`DA:` records, which are source lines. That is the difference between a
hundred per cent that means something and one that cannot be reached.

## Two rules that make the numbers honest

**Shared test doubles live in `bancada-testing`**, which the report excludes.
The same fake `Runtime` had been written four times, each drifting on its
own, and its unreached arms were scored as uncovered product code.

**Narrow with `find_map(…).expect(…)`, not `let … else { panic! }`.** The
failure arm then sits in `Option::expect`, in the standard library, rather
than in a line no passing test ever reaches.

## Artifacts

Nothing a test writes may land in the repository. CI proves it rather than
trusting it: after the tests, `git diff --exit-code` and a check that the
untracked list is empty. `.gitignore` would hide such a file instead of
catching it.

```sh
make clean    # build output and coverage; dependencies stay
make sweep    # everything rebuildable, dependencies included
```

`target/` reaches several gigabytes and coverage builds a second instrumented
tree beside it. `sweep` prints what it is about to remove, because the next
build after one is a long one and that should be a choice.

## No mutation testing

Deliberately, for now. It is the honest next question to ask of a suite at a
hundred per cent — coverage says a line ran, not that anything would notice
it changing — and it costs minutes per run that this repository does not have
to spend yet.

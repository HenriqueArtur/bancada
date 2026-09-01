#!/usr/bin/env python3
"""Hold each part of the tree to the number it earned.

One figure for a repository lets a module at nought hide behind a module at
a hundred, and the average keeps climbing while the hole stays. So the policy
is per area, and an area answers for itself.

Reads lcov, because lcov's `DA:` records are source lines — the same lines a
person counts reading the file. `llvm-cov`'s own summary counts more (macro
expansions, closing braces of functions that always return early) and
disagrees with what you see, which is not a number anybody can act on.

    tools/coverage-gate.py rust.info web:web/coverage/lcov.info

A `prefix:` says where that report's paths are relative to. `llvm-cov` writes
absolute paths and vitest writes them relative to its own root, so one of
them has to be told.
"""

import sys
from collections import Counter, defaultdict
from pathlib import Path

# Which files answer to which floor, first match wins.
#
# **Pure** is code that decides: given the same input it gives the same
# answer, and nothing about the machine can change it. Anything untested
# there is a branch nobody has ever run.
#
# **Edge** touches the world — a filesystem, a clock, a process, the screen.
# A percentage over `std::fs` is a floor against rot rather than a claim
# about quality, which is why it is a number and not a hundred.
#
# **Excluded** is scaffolding, arrangement, and code that is only the
# operating system. Each entry says why, because an exclusion nobody can
# argue with is an exclusion that spreads.
POLICY = [
    # ── excluded ─────────────────────────────────────────────────────────
    ("crates/bancada-testing/", None, "test doubles: the ladder, not the building"),
    ("app/src-tauri/src/main.rs", None, "three lines that call `run`"),
    ("app/src-tauri/src/lib.rs", None, "the Tauri builder — it needs a window to run at all"),
    (
        "app/src-tauri/src/commands/attention.rs",
        None,
        "a dock badge and a notification and nothing else; every decision it "
        "acts on is made in `core/attention.ts`, which is at a hundred",
    ),
    ("web/src/main.tsx", None, "the root render"),
    ("web/src/app.tsx", None, "which screen is showing — arrangement, and the shell"),
    ("web/src/frame/", None, "how things sit; there is nothing in it to decide"),
    ("web/src/layouts/", None, "where things go, knowing nothing about them"),
    ("/view.tsx", None, "a page's arrangement; its reasoning is in `logic.ts`"),
    ("/index.ts", None, "a barrel"),
    ("web/probe/", None, "a page for looking at components, not a component"),
    ("web/scripts/", None, "command-line tools, exercised by being run"),
    # ── edge, before the blanket rule below claims it ─────────────────────
    (
        "crates/bancada-runtime/",
        85.0,
        "the crate that touches the filesystem; its own test double cannot "
        "move to `bancada-testing`, which depends on it",
    ),
    # ── pure ──────────────────────────────────────────────────────────────
    ("crates/", 100.0, "pure"),
    ("web/src/core/", 100.0, "pure"),
    ("web/src/lib/", 100.0, "pure"),
    ("/logic.ts", 100.0, "pure"),
    # ── edge ──────────────────────────────────────────────────────────────
    ("app/src-tauri/", 85.0, "edge"),
    ("web/src/", 85.0, "edge"),
]


def bucket(path: str):
    for needle, floor, why in POLICY:
        if needle in path:
            return needle, floor, why
    return None, 85.0, "unclassified"


def read(files):
    """Line hits per source file, from every lcov given."""
    hits = defaultdict(dict)
    for spec in files:
        prefix, _, f = spec.rpartition(":") if ":" in spec else ("", "", spec)
        current = None
        for line in Path(f).read_text().splitlines():
            if line.startswith("SF:"):
                current = line[3:]
                if prefix and not current.startswith("/"):
                    current = f"{prefix}/{current}"
            elif line.startswith("DA:") and current:
                no, count = line[3:].split(",")[:2]
                hits[current][int(no)] = hits[current].get(int(no), 0) + int(count)
    return hits


def main(argv):
    if not argv:
        print(__doc__)
        return 2

    missing = [a.rpartition(":")[2] for a in argv if not Path(a.rpartition(":")[2]).exists()]
    if missing:
        print(f"no coverage report at {', '.join(missing)} — run `make cover` first")
        return 2

    hits = read(argv)
    total, covered = Counter(), Counter()
    reasons, offenders = {}, defaultdict(list)

    for path, lines in hits.items():
        rel = path.split("/bancada/")[-1]
        needle, floor, why = bucket(rel)
        if floor is None:
            continue
        reasons[needle] = why
        total[needle] += len(lines)
        missed = sum(1 for c in lines.values() if c == 0)
        covered[needle] += len(lines) - missed
        if missed:
            offenders[needle].append((rel, missed))

    failed = False
    for needle, _, _ in POLICY:
        if needle not in total:
            continue
        floor = dict((n, f) for n, f, _ in POLICY)[needle]
        pct = 100 * covered[needle] / total[needle]
        ok = pct >= floor - 1e-9
        failed |= not ok
        print(f"{'ok  ' if ok else 'FAIL'}  {needle:26} {pct:6.2f}%  (floor {floor:g}%)")
        if not ok:
            for rel, missed in sorted(offenders[needle], key=lambda x: -x[1])[:12]:
                print(f"          {rel}  {missed} line(s) uncovered")

    if failed:
        print("\nA floor is the number that part of the tree already reached.")
        print("Falling under it means something new arrived untested.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

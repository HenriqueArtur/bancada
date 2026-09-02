import { describe, expect, it } from "vitest";
import {
  branches,
  extensionOf,
  filtering,
  gapAbove,
  gapRows,
  kinds,
  leaf,
  NOTHING_FILTERED,
  openOnArrival,
  rows,
  sift,
  slice,
  totals,
  tooBig,
  tree,
} from "@/pages/review/logic";
import type { FileDiff, Hunk } from "@/core/review";

const file = (path: string, fresh = false, extra: Partial<FileDiff> = {}): FileDiff => ({
  path,
  added: 1,
  removed: 0,
  status: "modified",
  from: null,
  fingerprint: path,
  fresh,
  hunks: [],
  ...extra,
});

const only = (over: Partial<typeof NOTHING_FILTERED>) => ({ ...NOTHING_FILTERED, ...over });

const hunk = (newStart: number, newLines: number, lines: Hunk["lines"] = []): Hunk => ({
  header: `@@ -${newStart},${newLines} +${newStart},${newLines} @@`,
  oldStart: newStart,
  oldLines: newLines,
  newStart,
  newLines,
  lines,
});

describe("extensionOf", () => {
  it("is the extension of an ordinary file", () => {
    expect(extensionOf("web/src/core/review.ts")).toBe(".ts");
  });

  it("calls a file whose whole name is an extension a dotfile", () => {
    // `.gitignore` and `Makefile` both have "no extension" and are not the
    // same kind of file to anybody, so they do not share a tick.
    expect(extensionOf(".gitignore")).toBe("dotfile");
  });

  it("says none for a file with no extension at all", () => {
    expect(extensionOf("Makefile")).toBe("none");
  });

  it("takes the last extension, not the first", () => {
    expect(extensionOf("web/src/review.spec.tsx")).toBe(".tsx");
  });

  it("is not fooled by a dot in a directory name", () => {
    expect(extensionOf("src/v1.2/Makefile")).toBe("none");
  });
});

describe("kinds", () => {
  it("counts each extension that is actually here", () => {
    const got = kinds([file("a.rs"), file("b.rs"), file("c.tsx")]);
    expect(got).toEqual([
      { ext: ".rs", n: 2 },
      { ext: ".tsx", n: 1 },
    ]);
  });

  it("puts the commonest first, then settles ties by name", () => {
    const got = kinds([file("z.ts"), file("a.rs")]);
    expect(got.map((k) => k.ext)).toEqual([".rs", ".ts"]);
  });

  it("offers nothing for no files", () => {
    expect(kinds([])).toEqual([]);
  });
});

describe("filtering", () => {
  it("is false when nothing has been chosen", () => {
    expect(filtering(NOTHING_FILTERED)).toBe(false);
  });

  it("notices each filter on its own", () => {
    expect(filtering(only({ exts: [".rs"] }))).toBe(true);
    expect(filtering(only({ query: "core" }))).toBe(true);
    expect(filtering(only({ hideViewed: true }))).toBe(true);
    expect(filtering(only({ hideDeleted: true }))).toBe(true);
  });

  it("does not count a search of pure whitespace", () => {
    expect(filtering(only({ query: "   " }))).toBe(false);
  });
});

describe("sift", () => {
  const files = [
    file("web/b.tsx", true),
    file("crates/a.rs", false),
    file("web/c.tsx", false, { status: "deleted" }),
  ];

  it("keeps everything when nothing is filtered", () => {
    expect(sift(files, NOTHING_FILTERED).length).toBe(3);
  });

  it("keeps only the chosen extensions", () => {
    expect(sift(files, only({ exts: [".rs"] })).map((f) => f.path)).toEqual(["crates/a.rs"]);
  });

  it("treats no chosen extensions as every kind, not none", () => {
    // The difference bites when a file of a new kind appears while the
    // filter is open: an explicit set would not contain it and it would
    // vanish without anybody choosing to hide it.
    expect(sift(files, only({ exts: null })).length).toBe(3);
  });

  it("hides what you have already looked at", () => {
    expect(sift(files, only({ hideViewed: true })).map((f) => f.path)).toEqual(["web/b.tsx"]);
  });

  it("hides deleted files", () => {
    expect(sift(files, only({ hideDeleted: true })).some((f) => f.path === "web/c.tsx")).toBe(
      false,
    );
  });

  it("searches the whole path, not just the name", () => {
    expect(sift(files, only({ query: "crates" })).map((f) => f.path)).toEqual(["crates/a.rs"]);
  });

  it("ignores case and surrounding space in the search", () => {
    expect(sift(files, only({ query: "  CRATES  " })).length).toBe(1);
  });

  it("applies every filter at once", () => {
    expect(sift(files, only({ exts: [".rs"], hideViewed: true }))).toEqual([]);
  });

  it("returns path order, so the tree does not shuffle", () => {
    expect(sift(files, NOTHING_FILTERED).map((f) => f.path)).toEqual([
      "crates/a.rs",
      "web/b.tsx",
      "web/c.tsx",
    ]);
  });
});

describe("totals", () => {
  it("adds up the whole change", () => {
    const files = [
      file("a.rs", false, { added: 10, removed: 2 }),
      file("b.rs", false, { added: 5, removed: 30 }),
    ];
    expect(totals(files)).toEqual({ files: 2, added: 15, removed: 32 });
  });

  it("is all zeroes for a clean tree", () => {
    expect(totals([])).toEqual({ files: 0, added: 0, removed: 0 });
  });
});

describe("tree", () => {
  it("nests a file under each directory of its path", () => {
    const got = tree([file("web/src/app.tsx")]);
    expect(got).toEqual([
      {
        kind: "dir",
        name: "web/src",
        path: "web/src",
        children: [
          { kind: "file", file: expect.objectContaining({ path: "web/src/app.tsx" }) },
        ],
      },
    ]);
  });

  it("joins a chain of directories that hold nothing but each other", () => {
    // Without this, reaching the one changed file costs three clicks on
    // rows that exist only to hold the next row.
    const got = tree([file("a/b/c/d/only.ts")]);
    expect(got.length).toBe(1);
    expect(got[0].kind === "dir" && got[0].name).toBe("a/b/c/d");
  });

  it("stops joining where the tree actually forks", () => {
    const got = tree([file("web/src/core/a.ts"), file("web/src/lib/b.ts")]);
    expect(got[0].kind === "dir" && got[0].name).toBe("web/src");
    const kids = got[0].kind === "dir" ? got[0].children : [];
    expect(kids.map((n) => (n.kind === "dir" ? n.name : ""))).toEqual(["core", "lib"]);
  });

  it("keeps a directory that holds both a file and a directory", () => {
    const got = tree([file("web/a.ts"), file("web/deep/b.ts")]);
    expect(got[0].kind === "dir" && got[0].name).toBe("web");
  });

  it("puts directories above files and orders each by name", () => {
    const got = tree([file("z.md"), file("a.md"), file("dir/x.ts")]);
    expect(got.map((n) => (n.kind === "dir" ? n.name : leaf(n.file.path)))).toEqual([
      "dir",
      "a.md",
      "z.md",
    ]);
  });

  it("puts a file at the repository root at the top level", () => {
    const got = tree([file("README.md")]);
    expect(got[0].kind).toBe("file");
  });

  it("is empty for no files", () => {
    expect(tree([])).toEqual([]);
  });
});

describe("branches", () => {
  it("names every directory, however deep", () => {
    expect(branches(tree([file("web/src/core/a.ts"), file("web/src/lib/b.ts")]))).toEqual([
      "web/src",
      "web/src/core",
      "web/src/lib",
    ]);
  });

  it("names none when nothing is nested", () => {
    expect(branches(tree([file("README.md")]))).toEqual([]);
  });
});

describe("leaf", () => {
  it("is the last segment", () => {
    expect(leaf("web/src/core/review.ts")).toBe("review.ts");
  });

  it("is the whole thing when there is no directory", () => {
    expect(leaf("Makefile")).toBe("Makefile");
  });
});

describe("tooBig", () => {
  it("holds back a file with more changed lines than anyone reads", () => {
    expect(tooBig(file("bun.lock", true, { added: 900, removed: 0 }))).toBe(true);
  });

  it("holds back a file scattered across many hunks", () => {
    // A formatting sweep: every hunk is two lines, and there are forty.
    const many = Array.from({ length: 40 }, (_, i) => hunk(i * 10 + 1, 2));
    expect(tooBig(file("x.rs", true, { added: 40, removed: 40, hunks: many }))).toBe(true);
  });

  it("lets an ordinary file open", () => {
    expect(tooBig(file("x.rs", true, { added: 30, removed: 12, hunks: [hunk(1, 5)] }))).toBe(
      false,
    );
  });
});

describe("openOnArrival", () => {
  const big = (path: string, n: number) =>
    file(path, true, { added: n, removed: 0, hunks: [hunk(1, n)] });

  it("opens what you have not looked at", () => {
    expect(openOnArrival([file("a.rs", true)]).has("a.rs")).toBe(true);
  });

  it("leaves a file you vouched for folded", () => {
    expect(openOnArrival([file("a.rs", false)]).has("a.rs")).toBe(false);
  });

  it("leaves a file that speaks for itself folded", () => {
    // `tooBig` already gives it a reason and a way in. Opening it here would
    // spend the whole budget on the one file nobody reads line by line.
    expect(openOnArrival([big("bun.lock", 900)]).has("bun.lock")).toBe(false);
  });

  it("stops opening once the page has as much on it as anybody reads", () => {
    const many = Array.from({ length: 12 }, (_, i) => big(`f${i}.rs`, 200));
    const open = openOnArrival(many);
    expect(open.size).toBeGreaterThan(0);
    expect(open.size).toBeLessThan(many.length);
  });

  it("spends the budget in reading order, not at random", () => {
    // Two runs of the same list must fold the same files, or the page looks
    // different every time it reloads.
    const many = Array.from({ length: 12 }, (_, i) => big(`f${i}.rs`, 200));
    expect([...openOnArrival(many)]).toEqual([...openOnArrival(many)]);
    expect(openOnArrival(many).has("f0.rs")).toBe(true);
  });

  it("opens everything when the whole change is small", () => {
    const few = [file("a.rs", true), file("b.rs", true)];
    expect(openOnArrival(few).size).toBe(2);
  });
});

describe("gapAbove", () => {
  it("is the head of the file above the first hunk", () => {
    expect(gapAbove([hunk(20, 5)], 0)).toEqual({ from: 1, to: 19 });
  });

  it("is nothing when the first hunk starts at line one", () => {
    expect(gapAbove([hunk(1, 5)], 0)).toBeNull();
  });

  it("is the untouched body between two hunks", () => {
    // The first covers 10–14, the second starts at 40.
    expect(gapAbove([hunk(10, 5), hunk(40, 3)], 1)).toEqual({ from: 15, to: 39 });
  });

  it("is nothing when two hunks are adjacent", () => {
    expect(gapAbove([hunk(10, 5), hunk(15, 3)], 1)).toBeNull();
  });

  it("is nothing when git printed a header this side could not read", () => {
    // `newStart` of zero is the parser saying so. Expanding from line zero
    // would show the reader a slice of the wrong part of the file.
    expect(gapAbove([hunk(0, 0)], 0)).toBeNull();
    expect(gapAbove([hunk(0, 0), hunk(40, 3)], 1)).toBeNull();
  });

  it("is nothing for a hunk that is not there", () => {
    expect(gapAbove([], 0)).toBeNull();
  });
});

describe("slice", () => {
  const text = "one\ntwo\nthree\nfour\nfive";

  it("takes the lines a gap names, counting from one", () => {
    expect(slice(text, { from: 2, to: 4 })).toEqual(["two", "three", "four"]);
  });

  it("takes a single line", () => {
    expect(slice(text, { from: 1, to: 1 })).toEqual(["one"]);
  });

  it("stops at the end of a file shorter than the gap claims", () => {
    // The working tree moved under a diff read a moment ago. Showing the
    // three lines that exist beats throwing away the reader's click.
    expect(slice(text, { from: 4, to: 99 })).toEqual(["four", "five"]);
  });
});

describe("rows", () => {
  it("numbers a context line on both sides", () => {
    const got = rows(hunk(10, 1, [{ kind: "context", text: "fn open() {" }]));
    expect([got[0].oldNo, got[0].newNo]).toEqual([10, 10]);
  });

  it("gives a removed line no number in the new file", () => {
    const got = rows(hunk(10, 1, [{ kind: "removed", text: "old();" }]));
    expect([got[0].oldNo, got[0].newNo]).toEqual([10, null]);
  });

  it("gives an added line no number in the old file", () => {
    const got = rows(hunk(10, 1, [{ kind: "added", text: "new();" }]));
    expect([got[0].oldNo, got[0].newNo]).toEqual([null, 10]);
  });

  it("keeps the two sides drifting apart as the hunk goes on", () => {
    // The bug this catches: advancing both counters on every line. After one
    // addition the old side is a line behind for the rest of the hunk, and a
    // gutter that has silently slipped is worse than no gutter.
    const got = rows(
      hunk(1, 3, [
        { kind: "context", text: "a" },
        { kind: "added", text: "b" },
        { kind: "context", text: "c" },
      ]),
    );
    expect(got.map((l) => [l.oldNo, l.newNo])).toEqual([
      [1, 1],
      [null, 2],
      [2, 3],
    ]);
  });

  it("marks what changed inside a paired line", () => {
    const got = rows(
      hunk(1, 2, [
        { kind: "removed", text: "let x = one();" },
        { kind: "added", text: "let x = two();" },
      ]),
    );
    expect(got[1].parts?.filter((p) => p.changed).map((p) => p.text)).toEqual(["two"]);
  });
});

describe("gapRows", () => {
  const text = "one\ntwo\nthree\nfour\nfive";

  it("numbers both sides the same when nothing above shifted the file", () => {
    const got = gapRows(text, { from: 2, to: 3 }, hunk(4, 1));
    expect(got.map((l) => [l.oldNo, l.newNo, l.text])).toEqual([
      [2, 2, "two"],
      [3, 3, "three"],
    ]);
  });

  it("carries the drift the hunks above already introduced", () => {
    // Two lines were added before this point, so the new file is two ahead.
    const below: Hunk = { ...hunk(40, 3), oldStart: 38, oldLines: 3 };
    const got = gapRows(text, { from: 2, to: 2 }, below);
    expect([got[0].oldNo, got[0].newNo]).toEqual([0, 2]);
  });

  it("hands back context lines, never additions", () => {
    expect(
      gapRows(text, { from: 1, to: 5 }, hunk(6, 1)).every((l) => l.kind === "context"),
    ).toBe(true);
  });
});

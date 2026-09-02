import { describe, expect, it } from "vitest";
import type { Track, Worktree } from "@/core/review";
import { leafOf, search, trackOf, trackUnder } from "@/pages/files/logic";

const w = (files: Record<string, Track>, dirs: Record<string, Track> = {}): Worktree => ({
  files,
  dirs,
});

describe("trackOf", () => {
  it("says what happened to a path git named", () => {
    expect(trackOf(w({ "src/db.rs": "modified" }), "src/db.rs")).toBe("modified");
  });

  it("says nothing about a path git said nothing about", () => {
    expect(trackOf(w({}), "README.md")).toBeNull();
  });

  it("reads an ignored directory as covering everything under it", () => {
    // `target/` is one line and forty thousand paths, and git deliberately
    // prints none of them.
    const tree = w({}, { target: "ignored" });
    expect(trackOf(tree, "target/debug/deps/x.rlib")).toBe("ignored");
    expect(trackOf(tree, "target")).toBe("ignored");
  });

  it("does not read a directory whose name merely starts the same", () => {
    // `targeting/x.rs` is not inside `target`. Matching the prefix rather
    // than the segment would grey out a file somebody is working in.
    expect(trackOf(w({}, { target: "ignored" }), "targeting/x.rs")).toBeNull();
  });

  it("lets a file's own state win over the directory above it", () => {
    const tree = w({ "target/keep.rs": "modified" }, { target: "ignored" });
    expect(trackOf(tree, "target/keep.rs")).toBe("modified");
  });
});

describe("trackUnder", () => {
  it("colours a closed folder by what changed inside it", () => {
    // A closed folder that says nothing is a folder you have to open to
    // learn anything, which is most of the reason to colour a tree.
    expect(trackUnder(w({ "src/db.rs": "modified" }), "src")).toBe("modified");
  });

  it("puts a conflict above everything else under it", () => {
    const tree = w({ "src/a.rs": "modified", "src/b.rs": "conflicted", "src/c.rs": "added" });
    expect(trackUnder(tree, "src")).toBe("conflicted");
  });

  it("puts what is new above what merely changed", () => {
    expect(trackUnder(w({ "src/a.rs": "modified", "src/b.rs": "added" }), "src")).toBe("added");
  });

  it("ignores what is ignored, so one stale file does not grey a folder", () => {
    expect(trackUnder(w({ "src/junk.log": "ignored", "src/a.rs": "modified" }), "src")).toBe(
      "modified",
    );
  });

  it("says nothing about a folder with nothing in it", () => {
    expect(trackUnder(w({ "other/a.rs": "modified" }), "src")).toBeNull();
  });

  it("lets the folder's own state win, so an ignored one stays ignored", () => {
    expect(trackUnder(w({}, { target: "ignored" }), "target")).toBe("ignored");
  });

  it("does not count a folder whose name merely starts the same", () => {
    expect(trackUnder(w({ "srcx/a.rs": "modified" }), "src")).toBeNull();
  });
});

describe("search", () => {
  const paths = [
    "web/src/pages/review/logic.ts",
    "web/src/core/review.ts",
    "docs/review-me.md",
  ];

  it("matches anywhere in the path", () => {
    expect(search(paths, "core")).toEqual(["web/src/core/review.ts"]);
  });

  it("puts a match in the name above one in the directory", () => {
    // Typing `review` while looking for `review.ts` should not hand you the
    // files of a folder called review first.
    expect(search(paths, "review")[0]).toBe("docs/review-me.md");
    expect(search(paths, "review")).toContain("web/src/pages/review/logic.ts");
  });

  it("prefers the shorter path when both match the name", () => {
    expect(search(["a/b/c/x.ts", "x.ts"], "x.ts")[0]).toBe("x.ts");
  });

  it("ignores case and surrounding space", () => {
    expect(search(paths, "  CORE  ")).toEqual(["web/src/core/review.ts"]);
  });

  it("finds nothing for an empty search rather than everything", () => {
    // The tree is what you see when you are not searching. Returning every
    // path here would replace it with a flat list of the whole repository.
    expect(search(paths, "")).toEqual([]);
    expect(search(paths, "   ")).toEqual([]);
  });

  it("stops at a number of hits somebody could read", () => {
    const many = Array.from({ length: 500 }, (_, i) => `src/f${i}.ts`);
    expect(search(many, "src", 50)).toHaveLength(50);
  });
});

describe("leafOf", () => {
  it("is the last segment", () => {
    expect(leafOf("web/src/core/review.ts")).toBe("review.ts");
  });

  it("is the whole thing when there is no directory", () => {
    expect(leafOf("Makefile")).toBe("Makefile");
  });
});

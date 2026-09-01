import { describe, expect, it } from "vitest";
import { readingOrder } from "@/pages/review/logic";
import type { FileDiff } from "@/core/review";

const file = (path: string, fresh = false): FileDiff => ({
  path,
  added: 1,
  removed: 0,
  fingerprint: path,
  fresh,
  hunks: [],
});

describe("readingOrder", () => {
  it("puts what nobody announced above everything else", () => {
    // The whole argument of the screen. An ordering bug here looks like
    // nothing at all, which is why it is a function and not a sort inline.
    const got = readingOrder([file("a.rs"), file("z.rs")], ["z.rs"]);
    expect(got.map((f) => f.path)).toEqual(["z.rs", "a.rs"]);
  });

  it("puts what moved since you looked above what did not", () => {
    const got = readingOrder([file("a.rs", false), file("z.rs", true)], []);
    expect(got.map((f) => f.path)).toEqual(["z.rs", "a.rs"]);
  });

  it("ranks unannounced over merely fresh", () => {
    const got = readingOrder(
      [file("fresh.rs", true), file("surprise.rs", false)],
      ["surprise.rs"],
    );
    expect(got[0].path).toBe("surprise.rs");
  });

  it("falls back to the name, so two runs agree", () => {
    const got = readingOrder([file("b.rs"), file("a.rs"), file("c.rs")], []);
    expect(got.map((f) => f.path)).toEqual(["a.rs", "b.rs", "c.rs"]);
  });

  it("leaves the caller's array alone", () => {
    const files = [file("b.rs"), file("a.rs")];
    readingOrder(files, []);
    expect(files.map((f) => f.path)).toEqual(["b.rs", "a.rs"]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { forgetSeen, markSeen, seenOf, unmarkSeen } from "@/core/review";
describe("what this human has already looked at", () => {
  beforeEach(() => localStorage.clear());

  it("remembers nothing before anything is reviewed", () => {
    expect(seenOf("neo-gitmoji")).toEqual({});
  });

  it("pins the acknowledgement to the shape the file had", () => {
    markSeen("neo-gitmoji", "src/db.rs", "abc");
    expect(seenOf("neo-gitmoji")["src/db.rs"]).toBe("abc");
  });

  it("keeps one project's review out of another's", () => {
    markSeen("a", "src/db.rs", "abc");
    expect(seenOf("b")).toEqual({});
  });

  it("forgets one project without touching the rest", () => {
    markSeen("a", "x.rs", "1");
    markSeen("b", "y.rs", "2");
    forgetSeen("a");
    expect(seenOf("a")).toEqual({});
    expect(seenOf("b")["y.rs"]).toBe("2");
  });

  it("survives a corrupted store rather than blanking the screen", () => {
    localStorage.setItem("bancada.seen", "{not json");
    expect(seenOf("a")).toEqual({});
  });
});

describe("taking a review back", () => {
  beforeEach(() => localStorage.clear());

  it("forgets one file and leaves the rest", () => {
    // The checkbox beside a file can be unticked. A control that looks
    // reversible and is not teaches the reader that the product's state is
    // not theirs to correct.
    markSeen("bancada", "a.rs", "one");
    markSeen("bancada", "b.rs", "two");
    unmarkSeen("bancada", "a.rs");
    expect(seenOf("bancada")).toEqual({ "b.rs": "two" });
  });

  it("shrugs at a project nobody has reviewed anything in", () => {
    expect(() => unmarkSeen("empty", "a.rs")).not.toThrow();
    expect(seenOf("empty")).toEqual({});
  });

  it("shrugs at a file that was never marked", () => {
    markSeen("bancada", "a.rs", "one");
    unmarkSeen("bancada", "never.rs");
    expect(seenOf("bancada")).toEqual({ "a.rs": "one" });
  });
});

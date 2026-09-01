import { beforeEach, describe, expect, it } from "vitest";
import { churn, forgetSeen, markSeen, seenOf } from "@/core/review";
import { translator } from "@/core/language";

/// English, so every assertion reads as the phrase itself.
const t = translator({});

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

describe("churn", () => {
  const f = (added: number, removed: number) =>
    ({ path: "p", added, removed, fingerprint: "", fresh: true, hunks: [] });

  it("reads as a diff stat", () => {
    expect(churn(f(12, 3), t)).toBe("+12 \u22123");
  });

  it("says so plainly when nothing moved", () => {
    // A mode change or a rename produces a file with no line changes;
    // "+0 -0" reads like a bug.
    expect(churn(f(0, 0), t)).toBe("no lines");
  });
});

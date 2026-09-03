import { describe, expect, it } from "vitest";
import { age, detail, label, type Glance, type Ranked } from "@/core/queue";
import { translator } from "@/core/language";

/// English, so every assertion reads as the phrase itself.
const t = translator({});

const ranked = (over: Partial<Ranked["item"]> = {}): Ranked => ({
  item: {
    session: "s",
    kind: "Review",
    raised_at: 0,
    blocking: 0,
    project_weight: 1,
    project: "bancada",
    raised_by: null,
    ...over,
  },
  score: 1,
  age_ms: 0,
  kind_factor: 1,
  weighted_age_ms: 0,
  blocking_factor: 1,
});

const glance = (over: Partial<Glance> = {}): Glance => ({
  title: null,
  says: {},
  touched: 0,
  ...over,
});

describe("detail", () => {
  it("says what a question actually asked", () => {
    const g = glance({ says: { t1: "Which icon set?" } });
    expect(detail(ranked({ kind: "Question", raised_by: "t1" }), t, g)).toBe("Which icon set?");
  });

  it("counts the files a finished turn left behind", () => {
    expect(detail(ranked(), t, glance({ touched: 12 }))).toBe("12 files changed");
  });

  it("says the singular, because one file will happen constantly", () => {
    expect(detail(ranked(), t, glance({ touched: 1 }))).toBe("1 file changed");
  });

  it("adds nothing rather than something empty", () => {
    // A row that says `Review ·` reads as a rendering bug.
    expect(detail(ranked(), t, glance())).toBeNull();
    expect(detail(ranked({ kind: "Question", raised_by: "t9" }), t, glance())).toBeNull();
  });

  it("survives a session the glance never reached", () => {
    expect(detail(ranked(), t)).toBeNull();
  });
});

describe("age", () => {
  it("reads the way a person says it", () => {
    expect(age(30_000, t)).toBe("just now");
    expect(age(11 * 60_000, t)).toBe("11min");
    expect(age(3 * 3_600_000 + 4 * 60_000, t)).toBe("3h04");
    expect(age(50 * 3_600_000, t)).toBe("2d");
  });
});

describe("label", () => {
  it("names every kind, so none can render blank", () => {
    for (const k of ["Question", "PlanApproval", "Permission", "Review", "Stalled"] as const) {
      expect(label(k, t).length).toBeGreaterThan(0);
    }
  });
});

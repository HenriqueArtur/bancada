import { describe, expect, it } from "vitest";
import { idsOf, newcomers, phrase, waiting } from "@/core/attention";
import type { Grouped, DecisionKind, Ranked, Queue } from "@/core/queue";

const ranked = (
  kind: DecisionKind,
  raised: number,
  session = "s1",
  project = "bancada",
): Ranked => ({
  item: { session, kind, raised_at: raised, blocking: 0, project_weight: 1, project },
  score: 1,
  age_ms: 0,
  kind_factor: 1,
  weighted_age_ms: 0,
  blocking_factor: 1,
});

const group = (items: Ranked[]): Grouped[] => [
  { session: items[0]?.item.session ?? "s1", items },
];

describe("newcomers", () => {
  it("says nothing on the first reading", () => {
    // Everything is new when you have never looked. Announcing a queue you
    // just opened trains you to dismiss the notification that matters.
    expect(newcomers(null, group([ranked("Question", 1)]))).toEqual([]);
  });

  it("finds the item that was not there before", () => {
    const before = idsOf(group([ranked("Question", 1)]));
    const fresh = newcomers(before, group([ranked("Question", 1), ranked("Review", 2)]));
    expect(fresh.map((r) => r.item.kind)).toEqual(["Review"]);
  });

  it("does not re-announce an item whose score moved", () => {
    const before = idsOf(group([ranked("Question", 1)]));
    const aged = group([{ ...ranked("Question", 1), score: 99, age_ms: 600_000 }]);
    expect(newcomers(before, aged)).toEqual([]);
  });

  it("does not re-announce an item that merely changed position", () => {
    const a = ranked("Question", 1);
    const b = ranked("Review", 2);
    const before = idsOf(group([a, b]));
    expect(newcomers(before, group([b, a]))).toEqual([]);
  });

  it("treats the same kind raised again as a new decision", () => {
    // Two permissions from one session are two things to answer; only the
    // moment it was raised separates them.
    const before = idsOf(group([ranked("Permission", 1)]));
    expect(newcomers(before, group([ranked("Permission", 1), ranked("Permission", 2)]))).toHaveLength(1);
  });
});

describe("phrase", () => {
  it("says nothing when nothing is new", () => {
    expect(phrase([])).toBeNull();
  });

  it("names the project and what it wants", () => {
    const a = phrase([ranked("Question", 1)])!;
    expect(a.title).toBe("bancada · a question");
    expect(a.body).toContain("s1");
  });

  it("counts rather than listing when several land at once", () => {
    const a = phrase([ranked("Question", 1), ranked("Review", 2), ranked("Permission", 3)])!;
    expect(a.title).toBe("bancada · 3 things need you");
    expect(a.body).toBe("a question, review, permission");
  });

  it("stops listing after three", () => {
    const many = [1, 2, 3, 4, 5].map((n) => ranked("Permission", n));
    expect(phrase(many)!.body).toMatch(/and 2 more$/);
  });
});

describe("waiting", () => {
  it("counts sessions, not items", () => {
    // Three permissions from one agent is one thing to go and deal with.
    const q = {
      wip: { sessions_waiting: 1, items: 3, limit: 3 },
    } as Queue;
    expect(waiting(q)).toBe(1);
  });
});

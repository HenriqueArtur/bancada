import { describe, expect, it } from "vitest";
import { waitingOn } from "@/pages/work/logic";
import type { DecisionKind, Queue, Ranked } from "@/core/queue";

const item = (project: string, kind: DecisionKind = "Review"): Ranked => ({
  item: {
    session: "s",
    kind,
    raised_at: 0,
    blocking: 0,
    project_weight: 1,
    project,
    raised_by: null,
  },
  score: 1,
  age_ms: 0,
  kind_factor: 1,
  weighted_age_ms: 0,
  blocking_factor: 1,
});

const queue = (items: Ranked[]): Queue => ({
  groups: [{ session: "s", items }],
  wip: { sessions_waiting: 1, items: items.length, limit: 4 },
  watching: 2,
  unreachable: [],
  glances: {},
  elsewhere: null,
});

describe("waitingOn", () => {
  it("counts only what belongs to that project", () => {
    const q = queue([item("bancada"), item("bancada"), item("neo-gitmoji")]);
    expect(waitingOn(q, "bancada")).toBe(2);
    expect(waitingOn(q, "neo-gitmoji")).toBe(1);
  });

  it("says zero for a project with nothing waiting", () => {
    // Which is most projects, most of the time, and the state this whole
    // screen exists to make visible.
    expect(waitingOn(queue([item("bancada")]), "quiet")).toBe(0);
  });

  it("counts decisions across sessions, not sessions", () => {
    // Two agents on one project holding one decision each is two things to
    // answer, and the badge beside the project has to say two.
    const q: Queue = {
      ...queue([]),
      groups: [
        { session: "a", items: [item("bancada")] },
        { session: "b", items: [item("bancada")] },
      ],
    };
    expect(waitingOn(q, "bancada")).toBe(2);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Group, collapse } from "@/pages/cockpit/group";
import type { Grouped, DecisionKind, Ranked } from "@/core/queue";

const ranked = (kind: DecisionKind, ageMin: number, raised = ageMin): Ranked => ({
  item: {
    session: "s",
    kind,
    raised_at: raised,
    blocking: 3,
    project_weight: 5,
    project: "bancada",
  },
  score: 42,
  age_ms: ageMin * 60_000,
  // Every factor distinct on purpose: with two of them equal, a test that
  // claims to check the weight would pass while reading the kind.
  kind_factor: 2,
  weighted_age_ms: 3_000_000,
  blocking_factor: 4,
});

const group = (items: Ranked[]): Grouped => ({ session: "sunne/api", items });

describe("collapse", () => {
  it("folds only repeated permissions", () => {
    const rows = collapse(group([ranked("Permission", 1, 1), ranked("Permission", 2, 2)]));
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
  });

  it("never folds two questions", () => {
    // Two questions are two decisions, and folding them would hide one
    // behind the other — the thing a per-decision queue exists to prevent.
    expect(collapse(group([ranked("Question", 1, 1), ranked("Question", 2, 2)]))).toHaveLength(2);
  });
});

describe("Group", () => {
  it("names the session the items belong to", () => {
    render(<Group group={group([ranked("Question", 5)])} />);
    expect(screen.getByText("sunne/api")).toBeTruthy();
  });

  it("offers a way into the project it came from", () => {
    const onOpen = vi.fn();
    render(<Group group={group([ranked("Question", 5)])} onOpen={onOpen} />);
    fireEvent.click(screen.getByText(/Open bancada/));
    expect(onOpen).toHaveBeenCalledWith("bancada");
  });

  it("keeps the arithmetic off the screen until it is asked for", () => {
    render(<Group group={group([ranked("Question", 5)])} />);
    expect(screen.queryByText("Score")).toBeNull();
    fireEvent.click(screen.getByText("a question"));
    for (const k of ["Kind", "Age", "Weight", "Blocking", "Score"]) {
      expect(screen.getByText(k)).toBeTruthy();
    }
  });
});

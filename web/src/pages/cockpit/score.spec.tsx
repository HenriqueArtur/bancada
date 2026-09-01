import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Score } from "@/pages/cockpit/score";
import type { Ranked } from "@/core/queue";

// Every factor distinct on purpose: with two of them equal, a test that
// claims to check the weight would pass while reading the kind.
const ranked: Ranked = {
  item: {
    session: "s",
    kind: "Question",
    raised_at: 0,
    blocking: 3,
    project_weight: 5,
    project: "bancada",
  },
  score: 42_000,
  age_ms: 600_000,
  kind_factor: 2,
  weighted_age_ms: 3_000_000,
  blocking_factor: 4,
};

describe("Score", () => {
  it("shows every factor that produced the number", () => {
    render(<Score r={ranked} />);
    expect(screen.getByText("×2")).toBeTruthy();
    expect(screen.getByText("10 min")).toBeTruthy();
    expect(screen.getByText("×5")).toBeTruthy();
    expect(screen.getByText("×4")).toBeTruthy();
  });

  it("groups the total so a large one can be read at a glance", () => {
    // A ranking is only trusted if it can be checked, and `42000` cannot be
    // checked as fast as `42,000`.
    render(<Score r={ranked} />);
    expect(screen.getByText("42,000")).toBeTruthy();
  });

  it("says what the weight does, since the number cannot", () => {
    render(<Score r={ranked} />);
    expect(screen.getByText(/never overrides the kind/i)).toBeTruthy();
  });
});

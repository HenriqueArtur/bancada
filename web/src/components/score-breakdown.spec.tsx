import { render, screen } from "@testing-library/react";
import { ScoreBreakdown } from "./score-breakdown";
import type { Ranked } from "../queue";

const ranked: Ranked = {
  // Every factor distinct on purpose: with two of them equal, a test that
  // claims to check the weight would pass while reading the kind.
  item: {
    session: "s",
    kind: "Question",
    raised_at: 0,
    blocking: 3,
    project_weight: 5,
    project: "neo-gitmoji",
  },
  score: 42,
  age_ms: 600_000,
  kind_factor: 2,
  weighted_age_ms: 3_000_000,
  blocking_factor: 4,
};

it("shows every factor that produced the score", () => {
  render(<ScoreBreakdown r={ranked} />);
  for (const k of ["kind", "age", "weight", "blocking", "score"]) {
    expect(screen.getByText(k)).toBeDefined();
  }
});

it("shows the weight the project carries, not a normalised one", () => {
  render(<ScoreBreakdown r={ranked} />);
  expect(screen.getByText("×5")).toBeDefined();
});

it("shows the age in minutes rather than milliseconds", () => {
  render(<ScoreBreakdown r={ranked} />);
  expect(screen.getByText("10min")).toBeDefined();
});

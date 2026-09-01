import { render, screen, fireEvent } from "@testing-library/react";
import { QueueGroup } from "./queue-group";
import type { Grouped, DecisionKind, Ranked } from "../queue";

function ranked(kind: DecisionKind, ageMin: number): Ranked {
  return {
    item: {
      session: "s",
      kind,
      raised_at: 0,
      blocking: 0,
      project_weight: 1,
      project: "neo-gitmoji",
    },
    score: ageMin,
    age_ms: ageMin * 60_000,
    kind_factor: 1,
    weighted_age_ms: ageMin * 60_000,
    blocking_factor: 1,
  };
}
const group = (items: Ranked[]): Grouped => ({ session: "sunne/api", items });

it("names the session the items belong to", () => {
  render(<QueueGroup group={group([ranked("Question", 5)])} />);
  expect(screen.getByText("sunne/api")).toBeDefined();
});

it("collapses identical permissions into one line with a count", () => {
  render(<QueueGroup group={group([ranked("Permission", 1), ranked("Permission", 1), ranked("Permission", 1)])} />);
  expect(screen.getByText("×3")).toBeDefined();
  expect(screen.getAllByText("permission")).toHaveLength(1);
});

it("never collapses two questions into one", () => {
  render(<QueueGroup group={group([ranked("Question", 1), ranked("Question", 2)])} />);
  expect(screen.getAllByText("a question")).toHaveLength(2);
});

it("keeps the arithmetic hidden until it is asked for", () => {
  render(<QueueGroup group={group([ranked("Question", 5)])} />);
  expect(screen.queryByText("score")).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText("score")).toBeDefined();
});

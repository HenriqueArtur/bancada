import { render, screen } from "@testing-library/react";
import { EmptyCockpit } from "./empty-cockpit";

it("says nothing needs you rather than showing an empty list", () => {
  render(<EmptyCockpit watching={3} />);
  expect(screen.getByText("Nothing needs you.")).toBeDefined();
  expect(screen.getByText(/Watching 3 projects/)).toBeDefined();
});

it("distinguishes quiet from unconfigured", () => {
  render(<EmptyCockpit watching={0} />);
  expect(screen.getByText(/No projects registered/)).toBeDefined();
});

import { render, screen } from "@testing-library/react";
import { WipBar } from "./wip-bar";

it("counts sessions rather than items", () => {
  render(<WipBar wip={{ sessions_waiting: 2, items: 9, limit: 4 }} />);
  expect(screen.getByText(/2 waiting/)).toBeDefined();
  expect(screen.getByText(/9 items/)).toBeDefined();
});

it("says nothing about a limit it is under", () => {
  const { container } = render(<WipBar wip={{ sessions_waiting: 2, items: 2, limit: 4 }} />);
  expect(container.textContent).not.toContain("over");
});

it("marks being the bottleneck", () => {
  const { container } = render(<WipBar wip={{ sessions_waiting: 5, items: 5, limit: 4 }} />);
  expect(container.querySelector(".over")).not.toBeNull();
});

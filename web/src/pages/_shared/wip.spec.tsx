import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WipBar } from "@/pages/_shared/wip";

describe("WipBar", () => {
  it("counts sessions rather than items", () => {
    render(<WipBar wip={{ sessions_waiting: 2, items: 9, limit: 4 }} />);
    // Six agents working cost nothing; five stalled on you mean you became
    // the bottleneck. Both numbers stay visible: two sessions holding nine
    // decisions is a different afternoon from two holding two.
    expect(screen.getByText(/2 waiting/)).toBeTruthy();
    expect(screen.getByText(/9 items/)).toBeTruthy();
  });

  it("says nothing about a limit it is under", () => {
    const { container } = render(<WipBar wip={{ sessions_waiting: 2, items: 2, limit: 4 }} />);
    expect(container.textContent).not.toContain("past");
  });

  it("marks being the bottleneck", () => {
    const { container } = render(<WipBar wip={{ sessions_waiting: 5, items: 5, limit: 4 }} />);
    expect(container.querySelector(".text-alarm")).not.toBeNull();
  });

  it("draws one pip per slot, lit up to what is waiting", () => {
    const { container } = render(<WipBar wip={{ sessions_waiting: 2, items: 2, limit: 4 }} />);
    const pips = container.querySelectorAll("span.rounded-full");
    expect(pips).toHaveLength(4);
    expect([...pips].filter((p) => p.className.includes("bg-clay"))).toHaveLength(2);
  });
});

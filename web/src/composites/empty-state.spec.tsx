import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components";
import { EmptyState } from "@/composites/empty-state";

describe("EmptyState", () => {
  it("says which kind of empty it is", () => {
    // An empty screen and a broken one look identical, so it always says.
    render(<EmptyState headline="Nothing needs you." detail="Watching 2 projects." />);
    expect(screen.getByText("Nothing needs you.")).toBeTruthy();
    expect(screen.getByText("Watching 2 projects.")).toBeTruthy();
  });

  it("offers nothing when there is nothing to offer", () => {
    const { container } = render(<EmptyState headline="Nothing needs you." />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("carries an action when one was given", () => {
    render(<EmptyState headline="x" action={<Button>Register one</Button>} />);
    expect(screen.getByText("Register one")).toBeTruthy();
  });
});

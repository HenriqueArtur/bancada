import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select } from "@/components/select";

describe("Select", () => {
  it("shows the placeholder when nothing is chosen", () => {
    // An empty string is not a value Radix can select, so it has to become
    // `undefined` on the way in — otherwise the trigger renders blank and
    // the placeholder never appears.
    render(<Select value="" onChange={vi.fn()} choices={[]} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("shows the chosen label rather than its value", () => {
    render(
      <Select
        value="this-machine"
        onChange={vi.fn()}
        choices={[{ value: "this-machine", label: "This machine" }]}
      />,
    );
    expect(screen.getByText("This machine")).toBeTruthy();
  });
});

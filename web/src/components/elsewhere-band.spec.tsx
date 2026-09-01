import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ElsewhereBand } from "./elsewhere-band";

describe("ElsewhereBand", () => {
  it("says nothing about the real cockpit", () => {
    const { container } = render(<ElsewhereBand path={null} />);
    // A warning that is always on is a warning nobody reads.
    expect(container.firstChild).toBeNull();
  });

  it("names where the claim is actually about", () => {
    render(<ElsewhereBand path="/Users/h/.config/bancada/test.json" />);
    expect(screen.getByText("not your cockpit")).toBeTruthy();
    expect(screen.getByText(/test\.json/)).toBeTruthy();
  });
});

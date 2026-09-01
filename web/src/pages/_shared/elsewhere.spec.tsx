import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Elsewhere } from "@/pages/_shared/elsewhere";

describe("Elsewhere", () => {
  it("says nothing about the real cockpit", () => {
    // A warning that is always on is a warning nobody reads.
    const { container } = render(<Elsewhere path={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("names where the claim is actually about", () => {
    render(<Elsewhere path="/Users/h/.config/bancada/test.json" />);
    expect(screen.getByText("Not your cockpit")).toBeTruthy();
    expect(screen.getByText(/test\.json/)).toBeTruthy();
  });
});

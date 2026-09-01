import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/button";

describe("Button", () => {
  it("is an outline by default, because clay has to stay scarce", () => {
    // Clay means "this wants you". A screen with two primaries has already
    // lost the meaning, so the default must be the quiet one.
    render(<Button>Ok</Button>);
    expect(screen.getByText("Ok").className).toContain("border-line");
  });

  it("carries the clay only when asked", () => {
    render(<Button tone="primary">Go</Button>);
    expect(screen.getByText("Go").className).toContain("bg-clay");
  });

  it("lets the caller override a class rather than fighting it", () => {
    // `twMerge` is the whole reason `cn` exists: without it the winner is
    // decided by stylesheet order, which is not a place to keep a decision.
    render(<Button className="h-20">Tall</Button>);
    const cls = screen.getByText("Tall").className;
    expect(cls).toContain("h-20");
    expect(cls).not.toContain("h-9");
  });
});

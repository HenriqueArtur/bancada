import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Notice } from "@/composites/notice";

describe("Notice", () => {
  it("shows what it was told to say", () => {
    render(<Notice tone="found">4 sessions already recorded here</Notice>);
    expect(screen.getByText(/4 sessions/)).toBeTruthy();
  });

  it("gives each tone its own temperature", () => {
    // Three and no more. A palette of severities is a palette nobody
    // learns, and the only difference that matters is good, nothing yet,
    // and wrong.
    const tone = (t: "found" | "empty" | "missing") =>
      render(<Notice tone={t}>x</Notice>).container.firstElementChild?.className ?? "";
    expect(tone("found")).toContain("sage");
    expect(tone("missing")).toContain("alarm");
    expect(tone("empty")).toContain("surface");
  });
});

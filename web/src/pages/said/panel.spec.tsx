import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntentPanel } from "@/pages/said/panel";

describe("IntentPanel", () => {
  it("quotes the claim rather than summarising it", () => {
    // A summary of a claim is a second claim, and the point of the panel is
    // to hand the reviewer the original to hold the diff against.
    render(
      <IntentPanel
        sessions={[{ session: "abc12345", intent: "I will rename the parser", touched: [] }]}
      />,
    );
    expect(screen.getByText("I will rename the parser")).toBeTruthy();
  });

  it("says plainly when a session changed files without announcing", () => {
    render(
      <IntentPanel
        sessions={[{ session: "abc12345", intent: null, touched: ["a.rs", "b.rs"] }]}
      />,
    );
    // The plural is chosen before the lookup, so the phrase is whole.
    expect(screen.getByText("Changed 2 files without saying it would.")).toBeTruthy();
  });

  it("distinguishes an empty project from a silent one", () => {
    render(<IntentPanel sessions={[]} />);
    expect(screen.getByText(/No session in this project/)).toBeTruthy();
  });
});

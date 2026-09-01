import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntentPanel } from "./intent-panel";

describe("IntentPanel", () => {
  it("quotes the claim rather than summarising it", () => {
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
    expect(screen.getByText(/changed 2 file\(s\) without saying/)).toBeTruthy();
  });

  it("distinguishes an empty project from a silent one", () => {
    render(<IntentPanel sessions={[]} />);
    expect(screen.getByText(/no session in this project/)).toBeTruthy();
  });
});

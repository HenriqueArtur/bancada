import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Stated } from "@/core/settings";
import { Resolved, Threshold, withLimits } from "@/pages/settings/limits";

describe("Threshold", () => {
  it("says nothing rather than zero when the box is emptied", () => {
    // `Number("")` is 0, and a zero weight would erase the project from the
    // order. Emptying a field is how you say "inherit", and it is one
    // keystroke away from every edit.
    const onChange = vi.fn();
    render(<Threshold label="Weight" value={3} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("shows an unstated number as empty, not as the default", () => {
    render(<Threshold label="Weight" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Weight")).toHaveValue("");
  });

  it("passes a number through", () => {
    const onChange = vi.fn();
    render(<Threshold label="Weight" value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe("Resolved", () => {
  it("names where an inherited number came from", () => {
    render(
      <Resolved
        limits={{
          idleAfterMinutes: { value: 15, from: "workspacePreset" },
          weight: { value: 1, from: "baseline" },
        }}
        workspace="Personal"
      />,
    );
    expect(screen.getByText(/Quiet for 15 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/preset on Personal/)).toBeInTheDocument();
  });

  it("says nothing about the source of a number the project states itself", () => {
    // A note under every line is a note nobody reads. The interesting case
    // is the number that came from somewhere else.
    render(
      <Resolved
        limits={{
          idleAfterMinutes: { value: 2, from: "project" },
          weight: { value: 3, from: "project" },
        }}
        workspace="Personal"
      />,
    );
    expect(screen.queryByText(/workspace/)).not.toBeInTheDocument();
  });
});

describe("withLimits", () => {
  it("keeps the numbers it was not asked about", () => {
    const p = { id: "x", limits: { weight: 3, preset: "normal" as const } };
    expect(withLimits(p, { idleAfterMinutes: 9 }).limits).toEqual({
      weight: 3,
      preset: "normal",
      idleAfterMinutes: 9,
    });
  });

  it("works on a thing that has stated nothing at all", () => {
    const bare: { limits?: Stated } = {};
    expect(withLimits(bare, { weight: 2 }).limits).toEqual({ weight: 2 });
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog, DialogFrame } from "@/components/dialog";

const open = (onOpenChange = vi.fn()) =>
  render(
    <Dialog open onOpenChange={onOpenChange}>
      <DialogFrame title="Settings" description="What the product was told.">
        <p>inside</p>
      </DialogFrame>
    </Dialog>,
  );

describe("DialogFrame", () => {
  it("shows what it was given", () => {
    open();
    expect(screen.getByText("inside")).toBeTruthy();
  });

  it("names itself for a screen reader even though the title is elsewhere", () => {
    // The visible title lives in the panel, so the frame carries a hidden
    // one. Radix warns without it, and the warning is right.
    open();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("What the product was told.")).toBeTruthy();
  });

  it("closes on the button", () => {
    const onOpenChange = vi.fn();
    open(onOpenChange);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on escape, which is the half nobody remembers to build", () => {
    const onOpenChange = vi.fn();
    open(onOpenChange);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

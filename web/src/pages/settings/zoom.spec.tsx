import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CLOSEST, FURTHEST } from "@/core/zoom";
import { ZoomPanel } from "@/pages/settings/zoom";

const show = (level: number, onChoose = vi.fn()) => {
  render(<ZoomPanel level={level} onChoose={onChoose} />);
  return onChoose;
};

describe("ZoomPanel", () => {
  it("says the size as a percentage somebody would say out loud", () => {
    show(0);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("says what it used to be, once it is not that", () => {
    show(2);
    expect(screen.getByText("144%")).toBeTruthy();
    expect(screen.getByText("was 100%")).toBeTruthy();
  });

  it("says nothing about the default while it is the default", () => {
    show(0);
    expect(screen.queryByText("was 100%")).toBeNull();
  });

  it("steps one level at a time", () => {
    const onChoose = show(1);
    fireEvent.click(screen.getByLabelText("Bigger"));
    expect(onChoose).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByLabelText("Smaller"));
    expect(onChoose).toHaveBeenCalledWith(0);
  });

  it("comes back to a hundred rather than to the middle of the range", () => {
    const onChoose = show(5);
    fireEvent.click(screen.getByLabelText("Back to 100%"));
    expect(onChoose).toHaveBeenCalledWith(0);
  });

  it("stops offering a direction there is nothing left in", () => {
    show(FURTHEST);
    expect(screen.getByLabelText("Bigger")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Smaller")).toHaveProperty("disabled", false);
  });

  it("stops the other way too", () => {
    show(CLOSEST);
    expect(screen.getByLabelText("Smaller")).toHaveProperty("disabled", true);
  });

  it("offers nothing to reset when there is nothing to reset", () => {
    show(0);
    expect(screen.getByLabelText("Back to 100%")).toHaveProperty("disabled", true);
  });

  it("prints the keys, because that is what anybody will use", () => {
    // A setting nobody can find does not exist; a setting somebody has to
    // discover the shortcut for is one they will keep opening this dialog
    // to reach.
    show(0);
    expect(screen.getByText(/⌘\+ and ⌘−/)).toBeTruthy();
  });
});

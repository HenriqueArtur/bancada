import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULTS } from "@/core/shortcuts";
import { KeysPanel } from "@/pages/settings/keys";

const show = (onChange = vi.fn()) => {
  render(<KeysPanel keys={DEFAULTS} onChange={onChange} />);
  return onChange;
};

describe("KeysPanel", () => {
  beforeEach(() => localStorage.clear());

  it("names what each key does, not just the key", () => {
    show();
    expect(screen.getByText("Show or hide the conversation")).toBeTruthy();
  });

  it("takes the next keystroke once you ask it to", () => {
    const onChange = show();
    fireEvent.click(screen.getAllByText("Change")[0]);
    expect(screen.getByText("Press the keys…")).toBeTruthy();

    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(onChange).toHaveBeenCalled();
  });

  it("refuses a keystroke another action already answers to, and says whose", () => {
    show();
    fireEvent.click(screen.getAllByText("Change")[0]);
    // `mod+0` belongs to the zoom reset.
    fireEvent.keyDown(window, { key: "0", metaKey: true });
    expect(screen.getByText("Back to 100% already answers to that one.")).toBeTruthy();
  });

  it("ignores a bare modifier, because it is on the way to a real key", () => {
    const onChange = show();
    fireEvent.click(screen.getAllByText("Change")[0]);
    fireEvent.keyDown(window, { key: "Meta", metaKey: true });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Press the keys…")).toBeTruthy();
  });

  it("refuses a key with no modifier rather than binding it", () => {
    const onChange = show();
    fireEvent.click(screen.getAllByText("Change")[0]);
    fireEvent.keyDown(window, { key: "j" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops listening when you press escape", () => {
    const onChange = show();
    fireEvent.click(screen.getAllByText("Change")[0]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Press the keys…")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("puts one back where it was", () => {
    const onChange = show();
    fireEvent.click(screen.getAllByText("Reset")[0]);
    expect(onChange).toHaveBeenCalled();
  });
});

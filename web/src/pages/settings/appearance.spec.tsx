import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppearancePanel } from "@/pages/settings/appearance";

describe("AppearancePanel", () => {
  it("offers following the machine as well as the two sides", () => {
    render(<AppearancePanel theme="system" onChoose={vi.fn()} />);
    expect(screen.getByText("Follow the system")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
  });

  it("marks the one in force, and only that one", () => {
    // `aria-current` is what a screen reader reads and what the selected
    // styling keys off, so one assertion covers both.
    const { container } = render(<AppearancePanel theme="dark" onChoose={vi.fn()} />);
    const marked = container.querySelectorAll("[aria-current]");
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain("Dark");
  });

  it("hands the choice up rather than keeping it", () => {
    // The palette is applied at the root, so this screen must not own it —
    // a second owner is a second answer to "is it dark".
    const onChoose = vi.fn();
    render(<AppearancePanel theme="system" onChoose={onChoose} />);
    fireEvent.click(screen.getByText("Light"));
    expect(onChoose).toHaveBeenCalledWith("light");
  });

  it("says where the choice is kept, because it is not in the config", () => {
    render(<AppearancePanel theme="system" onChoose={vi.fn()} />);
    expect(screen.getByText(/not in the configuration/)).toBeTruthy();
  });
});

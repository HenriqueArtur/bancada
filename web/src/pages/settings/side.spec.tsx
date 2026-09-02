import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidePanel } from "@/pages/settings/side";

describe("SidePanel", () => {
  it("says what each edge costs, not just its name", () => {
    render(<SidePanel side="right" onChoose={vi.fn()} />);
    expect(screen.getByText("Against the same edge as the file tree.")).toBeTruthy();
  });

  it("hands back the edge you picked", () => {
    const onChoose = vi.fn();
    render(<SidePanel side="right" onChoose={onChoose} />);
    fireEvent.click(screen.getByText("Left"));
    expect(onChoose).toHaveBeenCalledWith("left");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackToQueue } from "@/pages/_shared/back";
import type { Queue } from "@/core/queue";

const queue = (waiting: number): Queue => ({
  groups: [],
  wip: { sessions_waiting: waiting, items: waiting, limit: 4 },
  watching: 1,
  unreachable: [],
  glances: {},
  elsewhere: null,
});

describe("BackToQueue", () => {
  it("leads back to where the project was opened from", () => {
    // Always saying "Needs you" is right half the time; the other half is
    // the product deciding you were somewhere else.
    render(<BackToQueue queue={queue(0)} from="work" onBack={vi.fn()} />);
    expect(screen.getByText("Your work")).toBeTruthy();
  });

  it("defaults to the queue", () => {
    render(<BackToQueue queue={queue(0)} onBack={vi.fn()} />);
    expect(screen.getByText("Needs you")).toBeTruthy();
  });

  it("keeps saying how much is waiting, wherever it leads", () => {
    // Otherwise opening the file pane becomes a way to stop being told.
    render(<BackToQueue queue={queue(3)} from="work" onBack={vi.fn()} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("says nothing about a count of nothing", () => {
    const { container } = render(<BackToQueue queue={queue(0)} onBack={vi.fn()} />);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("goes back when pressed", () => {
    const onBack = vi.fn();
    render(<BackToQueue queue={queue(0)} onBack={onBack} />);
    fireEvent.click(screen.getByText("Needs you"));
    expect(onBack).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Text } from "@/components";
import { InsideProject } from "@/pages/_shared/inside";
import type { Queue } from "@/core/queue";

const queue = {
  groups: [],
  wip: { sessions_waiting: 2, items: 3, limit: 3 },
  elsewhere: null,
} as unknown as Queue;

const show = (over: Partial<Parameters<typeof InsideProject>[0]> = {}) =>
  render(
    <InsideProject
      project="bancada"
      workspace="personal"
      queue={queue}
      from="cockpit"
      onBack={vi.fn()}
      tabs={<Text as="span">tabs</Text>}
      {...over}
    >
      <Text as="span">the body</Text>
    </InsideProject>,
  );

describe("InsideProject", () => {
  it("names the project and the workspace it belongs to", () => {
    // The workspace is the confidentiality boundary. A diff shown without
    // one is a diff whose rules nobody stated.
    show();
    expect(screen.getByText("bancada")).toBeTruthy();
    expect(screen.getByText("personal")).toBeTruthy();
  });

  it("names only the project while the settings are still being read", () => {
    show({ workspace: null });
    expect(screen.getByText("bancada")).toBeTruthy();
    expect(screen.queryByText("personal")).toBeNull();
  });

  it("carries the way back, the tabs and the work in progress on every screen", () => {
    show();
    expect(screen.getByText("Needs you")).toBeTruthy();
    expect(screen.getByText("tabs")).toBeTruthy();
    expect(screen.getByText(/2 waiting/)).toBeTruthy();
  });

  it("gives the same chrome to a measured screen as to a full one", () => {
    // The whole reason this component exists: two shells meant the controls
    // moved as you changed tab.
    const wide = show().container.textContent;
    const narrow = show({ measured: true }).container.textContent;
    expect(narrow).toBe(wide);
  });

  it("shows the body it was given", () => {
    show();
    expect(screen.getAllByText("the body").length).toBeGreaterThan(0);
  });
});

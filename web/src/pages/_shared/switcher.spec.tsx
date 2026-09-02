import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Queue } from "@/core/queue";
import type { Standing, Work } from "@/core/work";
import { ProjectList, ProjectSwitcher } from "@/pages/_shared/switcher";

const queue = (over: Partial<Queue> = {}): Queue => ({
  groups: [],
  wip: { sessions_waiting: 0, items: 0, limit: 4 },
  watching: 3,
  asking: 2,
  silenced: 1,
  unreachable: [],
  glances: {},
  elsewhere: null,
  ...over,
});

const standing = (id: string, asking = true): Standing => ({
  project: {
    id,
    workspace: "personal",
    runtime: "this-machine",
    path: `/w/${id}`,
    weight: 1,
    idleAfterMinutes: 2,
  },
  sessions: 1,
  lastActivity: null,
  unreachable: null,
  asking,
});

const work = (): Work => ({
  workspaces: [
    {
      workspace: { id: "personal" },
      projects: [standing("bancada"), standing("archwarden", false)],
    },
    { workspace: { id: "work" }, projects: [standing("api")] },
    // A workspace with nothing in it offers nothing to switch to.
    { workspace: { id: "empty" }, projects: [] },
  ],
  orphans: [],
});

/// Through the list itself rather than through the popover: opening a Radix
/// portal in a test costs about seven seconds, and these nine were paying a
/// hundred and fifty for what this asserts in milliseconds.
const show = (over: Partial<Parameters<typeof ProjectList>[0]> = {}) => {
  const props = {
    project: "bancada",
    queue: queue(),
    work: work(),
    onOpen: vi.fn(),
    onMute: vi.fn(),
    ...over,
  };
  render(<ProjectList {...props} />);
  return props;
};

describe("ProjectSwitcher", () => {
  it("names the project and the boundary it belongs to", () => {
    render(
      <ProjectSwitcher
        project="bancada"
        workspace="personal"
        queue={queue()}
        work={work()}
        onOpen={vi.fn()}
        onMute={vi.fn()}
      />,
    );
    expect(screen.getByText("bancada")).toBeTruthy();
    expect(screen.getByText("personal")).toBeTruthy();
  });
});

describe("ProjectList", () => {
  it("groups what it offers by workspace", () => {
    show();
    expect(screen.getByText("PERSONAL".toLowerCase())).toBeTruthy();
    expect(screen.getByText("api")).toBeTruthy();
  });

  it("leaves out a workspace with nothing to switch to", () => {
    show();
    expect(screen.queryByText("empty")).toBeNull();
  });

  it("says how many are active and how many are silenced", () => {
    show();
    expect(screen.getByText("2 active · 1 silenced")).toBeTruthy();
  });

  it("opens the one you picked", () => {
    const { onOpen } = show();
    fireEvent.click(screen.getByText("api"));
    expect(onOpen).toHaveBeenCalledWith("api");
  });

  it("carries what is waiting, so you can see where to go next", () => {
    show({
      queue: queue({
        groups: [
          {
            session: "s",
            items: [
              {
                item: {
                  session: "s",
                  kind: "Question",
                  raised_at: 0,
                  blocking: 0,
                  project_weight: 1,
                  raised_by: null,
                  project: "api",
                },
                score: 1,
                age_ms: 0,
                kind_factor: 1,
                weighted_age_ms: 0,
                blocking_factor: 1,
              },
            ],
          },
        ],
      }),
    });
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("silences one from where you are already looking", () => {
    const { onMute } = show();
    fireEvent.click(screen.getByLabelText("Silence api"));
    expect(onMute).toHaveBeenCalledWith("api", true);
  });

  it("lets a silenced one speak again", () => {
    const { onMute } = show();
    fireEvent.click(screen.getByLabelText("Let archwarden ask again"));
    expect(onMute).toHaveBeenCalledWith("archwarden", false);
  });

  it("says it is still reading rather than showing an empty list", () => {
    show({ work: null });
    expect(screen.getByText("Reading the projects…")).toBeTruthy();
  });
});

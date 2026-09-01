import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Config } from "@/core/settings";

const discover = vi.fn();
vi.mock("@/core/settings", async () => {
  const real = await vi.importActual<typeof import("@/core/settings")>("@/core/settings");
  return { ...real, discover: () => discover() };
});

const { MachinesPanel } = await import("@/pages/settings/machines");

const config: Config = {
  workspaces: [],
  projects: [],
  runtimes: [
    {
      id: "this-machine",
      kind: "local",
      prefix: [],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/Users/h/.claude",
      sharedFs: true,
    },
    {
      id: "devbox",
      kind: "vm",
      prefix: ["limactl", "shell", "devbox", "--"],
      hostRoot: "/h",
      guestRoot: "/mnt/dev",
      configDir: "/state",
      sharedFs: true,
    },
  ],
};

describe("MachinesPanel", () => {
  it("marks the machine it runs on as needing no registering", () => {
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    expect(screen.getByText("Always here")).toBeTruthy();
    expect(screen.getByText("This machine")).toBeTruthy();
  });

  it("says a machine with no prefix runs commands directly", () => {
    // "No prefix" alone reads as something missing.
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    expect(screen.getByText(/commands run directly/)).toBeTruthy();
  });

  it("shows the prefix a VM needs in front of every command", () => {
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    expect(screen.getByText("limactl shell devbox --")).toBeTruthy();
  });

  it("does not probe until asked", () => {
    // Probing shells into every VM, and a settings screen that did it on
    // open would hang on a machine that is asleep.
    discover.mockReset();
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    expect(discover).not.toHaveBeenCalled();
  });

  it("reports what a machine turned out to have", async () => {
    discover.mockReset().mockResolvedValue([
      {
        runtime: "devbox",
        harness: {
          path: "/c",
          version: "2.1.221",
          loggedIn: true,
          account: { uuid: "u", email: "a@b.c", organization: "Org" },
        },
        error: null,
      },
    ]);
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    fireEvent.click(screen.getByText("Ask them what they have"));
    expect(await screen.findByText(/2\.1\.221 · a@b\.c/)).toBeTruthy();
  });

  it("says when a machine has the harness but nobody is signed in", async () => {
    discover.mockReset().mockResolvedValue([
      {
        runtime: "devbox",
        harness: { path: "/c", version: "2.1", loggedIn: false, account: null },
        error: null,
      },
    ]);
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    fireEvent.click(screen.getByText("Ask them what they have"));
    expect(await screen.findByText(/logged out/)).toBeTruthy();
  });

  it("distinguishes a machine with nothing installed from one that refused", async () => {
    discover.mockReset().mockResolvedValue([
      { runtime: "this-machine", harness: null, error: null },
      { runtime: "devbox", harness: null, error: "vz: CanRequestStop is not supported" },
    ]);
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    fireEvent.click(screen.getByText("Ask them what they have"));
    expect(await screen.findByText("No harness installed")).toBeTruthy();
    expect(screen.getByText(/CanRequestStop/)).toBeTruthy();
  });

  it("keeps the form for another machine folded away", () => {
    // Most people describe a runtime a handful of times ever, and a
    // six-field form sitting open makes the common case look as hard.
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    expect(screen.getByText("Describe another machine")).toBeTruthy();
    expect(screen.queryByText("Register it")).toBeNull();
  });

  it("refuses a machine until it is described, one reason at a time", () => {
    render(<MachinesPanel config={config} onRegister={vi.fn()} />);
    fireEvent.click(screen.getByText("Describe another machine"));
    expect(screen.getByText("give the machine a name")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Call it"), { target: { value: "this-machine" } });
    expect(screen.getByText(/belongs to the machine bancada runs on/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Call it"), { target: { value: "devbox" } });
    expect(screen.getByText("devbox is already registered")).toBeTruthy();
  });

  it("hands up a machine once it is fully described", async () => {
    const onRegister = vi.fn();
    render(<MachinesPanel config={config} onRegister={onRegister} />);
    fireEvent.click(screen.getByText("Describe another machine"));
    fireEvent.change(screen.getByLabelText("Call it"), { target: { value: "sunne" } });
    fireEvent.change(screen.getByLabelText(/in front of every command/), {
      target: { value: "limactl shell sunne --" },
    });
    fireEvent.change(screen.getByLabelText(/harness keeps state/), {
      target: { value: "/state/sunne" },
    });
    fireEvent.click(screen.getByText("Register it"));

    await waitFor(() =>
      expect(onRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "sunne",
          prefix: ["limactl", "shell", "sunne", "--"],
          configDir: "/state/sunne",
        }),
      ),
    );
  });
});

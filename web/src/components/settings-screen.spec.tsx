import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Config } from "../settings";

const loadSettings = vi.fn();
const registerProject = vi.fn();
const forgetProject = vi.fn();
const discover = vi.fn();

vi.mock("../settings", async () => {
  const real = await vi.importActual<typeof import("../settings")>("../settings");
  return {
    ...real,
    loadSettings: () => loadSettings(),
    registerProject: (p: unknown) => registerProject(p),
    forgetProject: (id: string) => forgetProject(id),
    discover: () => discover(),
  };
});

const { SettingsScreen } = await import("./settings-screen");

const config: Config = {
  workspaces: [{ id: "personal" }],
  runtimes: [
    {
      id: "devbox",
      kind: "vm",
      prefix: ["limactl", "shell", "devbox", "--"],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/state/claude",
      sharedFs: true,
    },
  ],
  projects: [],
};

describe("SettingsScreen", () => {
  it("says nothing is registered rather than showing an empty table", async () => {
    loadSettings.mockResolvedValue(config);
    render(<SettingsScreen />);
    expect(await screen.findByText("nothing registered yet")).toBeTruthy();
  });

  it("keeps register disabled until the form says why not", async () => {
    loadSettings.mockResolvedValue(config);
    render(<SettingsScreen />);
    const button = (await screen.findByText("register")) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("give it a name")).toBeTruthy();
  });

  it("shows the log directory before saving, because the encoding is lossy", async () => {
    loadSettings.mockResolvedValue(config);
    render(<SettingsScreen />);
    await screen.findByText("nothing registered yet");
    fireEvent.change(screen.getByLabelText(/path/), {
      target: { value: "/mnt/dev/neo-gitmoji.nvim" },
    });
    expect(
      await screen.findByText(/projects\/-mnt-dev-neo-gitmoji-nvim/),
    ).toBeTruthy();
  });

  it("only offers runtimes and workspaces that exist", async () => {
    loadSettings.mockResolvedValue(config);
    render(<SettingsScreen />);
    const runtime = (await screen.findByLabelText("runtime")) as HTMLSelectElement;
    // The blank placeholder plus exactly what is registered — a free-text
    // field here is how a project ends up pointing at nothing.
    expect([...runtime.options].map((o) => o.value)).toEqual(["", "devbox"]);
  });

  it("tells the caller when the configuration changed", async () => {
    const onChanged = vi.fn();
    loadSettings.mockResolvedValue({
      ...config,
      projects: [
        {
          id: "neo-gitmoji",
          workspace: "personal",
          runtime: "devbox",
          path: "/mnt/dev/x",
          weight: 1,
          idleAfterMinutes: 2,
        },
      ],
    });
    forgetProject.mockResolvedValue(config);
    render(<SettingsScreen onChanged={onChanged} />);
    fireEvent.click(await screen.findByText("forget"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("does not probe until asked", async () => {
    loadSettings.mockResolvedValue(config);
    render(<SettingsScreen />);
    await screen.findByText("probe runtimes");
    // Probing shells into every VM. A settings screen that did it on open
    // would hang on a machine that is asleep.
    expect(discover).not.toHaveBeenCalled();
  });
});

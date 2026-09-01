import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Config, Preview } from "../settings";

const loadSettings = vi.fn();
const registerProject = vi.fn();
const forgetProject = vi.fn();
const discover = vi.fn();
const previewProject = vi.fn();
const pickFolder = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...a: unknown[]) => pickFolder(...a) }));
vi.mock("../settings", async () => {
  const real = await vi.importActual<typeof import("../settings")>("../settings");
  return {
    ...real,
    loadSettings: () => loadSettings(),
    registerProject: (p: unknown) => registerProject(p),
    forgetProject: (id: string) => forgetProject(id),
    registerRuntime: vi.fn(),
    discover: () => discover(),
    previewProject: (...a: unknown[]) => previewProject(...a),
  };
});

const { SettingsScreen } = await import("./settings-screen");

const config: Config = {
  workspaces: [{ id: "personal" }],
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
  ],
  projects: [],
};

const preview = (over: Partial<Preview> = {}): Preview => ({
  sessions: 4,
  reachable: true,
  versioned: true,
  logDir: "/Users/h/.claude/projects/-Users-h-dev-thing",
  why: null,
  ...over,
});

const open = () => {
  loadSettings.mockResolvedValue(config);
  render(<SettingsScreen />);
  return screen.findByText("nothing registered yet");
};

describe("SettingsScreen", () => {
  it("says nothing is registered rather than showing an empty table", async () => {
    await open();
  });

  it("fills the path and the name from the folder you picked", async () => {
    pickFolder.mockResolvedValue("/Users/h/dev/thing");
    previewProject.mockResolvedValue(preview());
    await open();
    fireEvent.click(screen.getByText("browse"));

    await waitFor(() =>
      expect((screen.getByPlaceholderText(/Users\/you/) as HTMLInputElement).value).toBe(
        "/Users/h/dev/thing",
      ),
    );
    // The last segment, and nothing clever. Somebody who wants a different
    // name types one; somebody who does not should not have to invent one.
    expect((screen.getByPlaceholderText("from the folder name") as HTMLInputElement).value).toBe(
      "thing",
    );
  });

  it("confirms with evidence rather than with an encoded directory name", async () => {
    previewProject.mockResolvedValue(preview());
    await open();
    fireEvent.change(screen.getByPlaceholderText(/Users\/you/), {
      target: { value: "/Users/h/dev/thing" },
    });
    expect(await screen.findByText(/4 sessions already recorded here/)).toBeTruthy();
  });

  it("says plainly when the folder cannot be reached", async () => {
    previewProject.mockResolvedValue(
      preview({ reachable: false, sessions: 0, why: "no such directory" }),
    );
    await open();
    fireEvent.change(screen.getByPlaceholderText(/Users\/you/), {
      target: { value: "/nope" },
    });
    expect(await screen.findByText(/no such directory/)).toBeTruthy();
  });

  it("warns that a folder outside version control has no diff to review", async () => {
    previewProject.mockResolvedValue(preview({ versioned: false }));
    await open();
    fireEvent.change(screen.getByPlaceholderText(/Users\/you/), {
      target: { value: "/Users/h/notes" },
    });
    expect(await screen.findByText(/not a git repository/)).toBeTruthy();
  });

  it("keeps the button disabled and says the one thing missing", async () => {
    await open();
    const button = screen.getByText("watch it") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("give it a name")).toBeTruthy();
  });

  it("folds away everything that has a sane default", async () => {
    await open();
    // Present, so nothing is unreachable — but closed, so the common case
    // does not look as hard as the rare one.
    const advanced = document.querySelector("details.advanced") as HTMLDetailsElement;
    expect(advanced.open).toBe(false);
    expect(advanced.textContent).toContain("weight");
  });

  it("does not probe until asked", async () => {
    await open();
    // Probing shells into every VM. A settings screen that did it on open
    // would hang on a machine that is asleep.
    expect(screen.getByText("ask them what they have")).toBeTruthy();
    expect(discover).not.toHaveBeenCalled();
  });

  it("tells the caller when the configuration changed", async () => {
    const onChanged = vi.fn();
    loadSettings.mockResolvedValue({
      ...config,
      projects: [
        {
          id: "thing",
          workspace: "personal",
          runtime: "this-machine",
          path: "/Users/h/dev/thing",
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
});

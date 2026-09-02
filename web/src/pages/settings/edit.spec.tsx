import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Config } from "@/core/settings";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@/core/settings", async () => {
  const real = await vi.importActual<typeof import("@/core/settings")>("@/core/settings");
  return { ...real, previewProject: () => new Promise(() => {}) };
});

const { WorkspacesPanel } = await import("@/pages/settings/workspaces");
const { ProjectsPanel } = await import("@/pages/settings/projects");

const config: Config = {
  workspaces: [{ id: "personal", export: "metadata" }],
  runtimes: [
    {
      id: "this-machine",
      kind: "local",
      prefix: [],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/Users/h/.claude",
      sharedFs: true,
      harness: null,
      model: null,
    },
  ],
  projects: [
    {
      id: "bancada",
      workspace: "personal",
      runtime: "this-machine",
      path: "/Users/h/dev/bancada",
      weight: 1,
      idleAfterMinutes: 2,
    },
  ],
};

describe("editing a workspace", () => {
  it("fills the form from the one you picked", async () => {
    render(
      <WorkspacesPanel config={config} onRegister={vi.fn()} onForget={vi.fn()} failed={null} />,
    );
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() =>
      expect((screen.getByLabelText(/Whose work/) as HTMLInputElement).value).toBe("personal"),
    );
  });

  it("lets you type into it", async () => {
    // It did not. `editing ?? draft` meant the field rendered from the prop
    // for as long as editing was set, so every keystroke wrote to state
    // nothing was reading.
    render(
      <WorkspacesPanel config={config} onRegister={vi.fn()} onForget={vi.fn()} failed={null} />,
    );
    fireEvent.click(screen.getByText("Edit"));
    const field = await screen.findByLabelText(/Whose work/);
    fireEvent.change(field, { target: { value: "mine" } });
    expect((field as HTMLInputElement).value).toBe("mine");
  });

  it("hands back the old name so the rename can move its projects", async () => {
    const onRegister = vi.fn();
    render(
      <WorkspacesPanel
        config={config}
        onRegister={onRegister}
        onForget={vi.fn()}
        failed={null}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(await screen.findByLabelText(/Whose work/), { target: { value: "mine" } });
    fireEvent.click(screen.getByText("Save changes"));
    expect(onRegister).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mine" }),
      "personal",
    );
  });

  it("goes back to being a blank form when you cancel", async () => {
    render(
      <WorkspacesPanel config={config} onRegister={vi.fn()} onForget={vi.fn()} failed={null} />,
    );
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(await screen.findByText("Cancel"));
    await waitFor(() =>
      expect((screen.getByLabelText(/Whose work/) as HTMLInputElement).value).toBe(""),
    );
    expect(screen.getByText("New workspace")).toBeTruthy();
  });
});

describe("editing a project", () => {
  it("fills the form from the one you picked", async () => {
    render(<ProjectsPanel config={config} onRegister={vi.fn()} onForget={vi.fn()} />);
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() =>
      expect((screen.getByLabelText("Path") as HTMLInputElement).value).toBe(
        "/Users/h/dev/bancada",
      ),
    );
  });

  it("lets you type into it", async () => {
    render(<ProjectsPanel config={config} onRegister={vi.fn()} onForget={vi.fn()} />);
    fireEvent.click(screen.getByText("Edit"));
    const field = await screen.findByPlaceholderText("From the folder name");
    fireEvent.change(field, { target: { value: "renamed" } });
    expect((field as HTMLInputElement).value).toBe("renamed");
  });

  it("hands back the old name so nothing is left behind", async () => {
    const onRegister = vi.fn();
    render(<ProjectsPanel config={config} onRegister={onRegister} onForget={vi.fn()} />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(await screen.findByPlaceholderText("From the folder name"), {
      target: { value: "renamed" },
    });
    fireEvent.click(screen.getByText("Save changes"));
    expect(onRegister).toHaveBeenCalledWith(
      expect.objectContaining({ id: "renamed" }),
      "bancada",
    );
  });
});

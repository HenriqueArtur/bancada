import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Config } from "@/core/settings";

const loadSettings = vi.fn();
const registerProject = vi.fn();
const forgetProject = vi.fn();
const registerRuntime = vi.fn();
const discover = vi.fn();
const registerWorkspace = vi.fn();
const forgetWorkspace = vi.fn();

vi.mock("@/core/settings", async () => {
  const real = await vi.importActual<typeof import("@/core/settings")>("@/core/settings");
  return {
    ...real,
    loadSettings: () => loadSettings(),
    registerProject: (...a: unknown[]) => registerProject(...a),
    forgetProject: (...a: unknown[]) => forgetProject(...a),
    registerRuntime: (...a: unknown[]) => registerRuntime(...a),
    discover: () => discover(),
    previewProject: () => new Promise(() => {}),
  };
});
vi.mock("@/core/work", async () => {
  const real = await vi.importActual<typeof import("@/core/work")>("@/core/work");
  return {
    ...real,
    registerWorkspace: (...a: unknown[]) => registerWorkspace(...a),
    forgetWorkspace: (...a: unknown[]) => forgetWorkspace(...a),
  };
});

const { useSettings, useDiscovery } = await import("@/pages/settings/logic");

const config: Config = { workspaces: [{ id: "personal" }], runtimes: [], projects: [] };
const project = {
  id: "p",
  workspace: "personal",
  runtime: "this-machine",
  path: "/x",
  weight: 1,
  idleAfterMinutes: 2,
};

describe("useSettings", () => {
  beforeEach(() => {
    for (const m of [
      loadSettings,
      registerProject,
      forgetProject,
      registerRuntime,
      registerWorkspace,
      forgetWorkspace,
    ]) {
      m.mockReset().mockResolvedValue(config);
    }
  });

  it("reads the configuration as soon as it is mounted", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.config).toEqual(config));
  });

  it("names a configuration it could not read", async () => {
    loadSettings.mockRejectedValue(new Error("malformed"));
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.failed).toMatch(/malformed/));
  });

  it("tells the caller after every kind of change", async () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useSettings(onChanged));
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.register(project, "was"));
    await waitFor(() => expect(registerProject).toHaveBeenCalledWith(project, "was"));

    act(() => result.current.forget("p"));
    act(() =>
      result.current.addRuntime({
        id: "r",
        kind: "vm",
        prefix: [],
        hostRoot: "/",
        guestRoot: "/",
        configDir: "/s",
        sharedFs: true,
      }),
    );
    act(() => result.current.addWorkspace({ id: "w" }, "old"));
    act(() => result.current.dropWorkspace("w"));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(5));
    expect(registerWorkspace).toHaveBeenCalledWith({ id: "w" }, "old");
    expect(forgetWorkspace).toHaveBeenCalledWith("w");
  });

  it("shows why a change was refused, and keeps what it had", async () => {
    // Forgetting a workspace that still holds projects is the case, and the
    // message names them — losing it would leave the screen silent.
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.config).not.toBeNull());
    forgetWorkspace.mockRejectedValue(new Error("personal still holds p"));

    act(() => result.current.dropWorkspace("personal"));
    await waitFor(() => expect(result.current.failed).toMatch(/still holds/));
    expect(result.current.config).toEqual(config);
  });
});

/// No `beforeEach` here, deliberately.
///
/// With one present, vitest reports the rejection in the last test as
/// unhandled — the hook shifts the tick on which it scans, to before the
/// hook's own `.catch` is attached. Each test sets what it needs.
describe("useDiscovery", () => {
  it("does not probe until asked", () => {
    discover.mockReset();
    const { result } = renderHook(() => useDiscovery());
    expect(discover).not.toHaveBeenCalled();
    expect(result.current.found.size).toBe(0);
  });

  it("keeps what each machine answered, by runtime", async () => {
    discover.mockReset();
    discover.mockResolvedValue([
      {
        runtime: "devbox",
        harness: { path: "/c", version: "2", loggedIn: true, account: null },
        error: null,
      },
    ]);
    const { result } = renderHook(() => useDiscovery());
    act(() => result.current.probe());
    await waitFor(() => expect(result.current.found.get("devbox")?.harness?.version).toBe("2"));
    expect(result.current.probing).toBe(false);
  });

  it("turns a refusal into something the screen can show", async () => {
    // A probe that throws must not leave the panel spinning with no reason.
    discover.mockReset();
    discover.mockImplementation(() => Promise.reject(new Error("no such VM")));
    const { result } = renderHook(() => useDiscovery());
    act(() => result.current.probe());
    await waitFor(() => expect(result.current.probing).toBe(false));
    expect([...result.current.found.values()][0]?.error).toMatch(/no such VM/);
  });
});

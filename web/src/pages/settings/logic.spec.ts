import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const previewProject = vi.fn();
vi.mock("@/core/settings", async () => {
  const real = await vi.importActual<typeof import("@/core/settings")>("@/core/settings");
  return { ...real, previewProject: (...a: unknown[]) => previewProject(...a) };
});

const { useDraftProject } = await import("@/pages/settings/logic");

describe("useDraftProject", () => {
  beforeEach(() => {
    previewProject.mockReset().mockResolvedValue({
      sessions: 4,
      reachable: true,
      versioned: true,
      logDir: "/x",
      why: null,
    });
  });

  it("names the project from the folder", () => {
    const { result } = renderHook(() => useDraftProject());
    act(() => result.current.setPath("/Users/h/dev/thing"));
    expect(result.current.draft.id).toBe("thing");
  });

  it("does not overwrite a name you typed", () => {
    // Somebody who wants a different name types one, and picking a folder
    // afterwards must not undo that.
    const { result } = renderHook(() => useDraftProject());
    act(() => result.current.setDraft((d) => ({ ...d, id: "mine" })));
    act(() => result.current.setPath("/Users/h/dev/thing"));
    expect(result.current.draft.id).toBe("mine");
  });

  it("asks nothing until there is an absolute path to ask about", async () => {
    const { result } = renderHook(() => useDraftProject());
    act(() => result.current.setPath("dev/thing"));
    await new Promise((r) => setTimeout(r, 320));
    expect(previewProject).not.toHaveBeenCalled();
  });

  it("looks the path up once the typing settles", async () => {
    const { result } = renderHook(() => useDraftProject());
    act(() => result.current.setPath("/Users/h/dev/thing"));
    await waitFor(() => expect(result.current.preview?.sessions).toBe(4));
    expect(previewProject).toHaveBeenCalledWith("/Users/h/dev/thing", "this-machine");
  });

  it("forgets the draft and the evidence together", async () => {
    // A stale count under an empty form is a claim about nothing.
    const { result } = renderHook(() => useDraftProject());
    act(() => result.current.setPath("/Users/h/dev/thing"));
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    act(() => result.current.clear());
    expect(result.current.draft.path).toBe("");
    expect(result.current.preview).toBeNull();
  });
});

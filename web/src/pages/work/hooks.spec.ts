import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { Work } from "@/core/work";

const loadWork = vi.fn();
vi.mock("@/core/work", async () => {
  const real = await vi.importActual<typeof import("@/core/work")>("@/core/work");
  return { ...real, loadWork: () => loadWork() };
});

const { useWork } = await import("@/pages/work/logic");

const work: Work = {
  workspaces: [{ workspace: { id: "personal" }, projects: [] }],
  orphans: [],
};

describe("useWork", () => {
  it("reads what is registered as soon as it is mounted", async () => {
    loadWork.mockReset().mockResolvedValue(work);
    const { result } = renderHook(() => useWork());
    await waitFor(() => expect(result.current.work).toEqual(work));
  });

  it("reads again when asked", async () => {
    loadWork.mockReset().mockResolvedValue(work);
    const { result } = renderHook(() => useWork());
    await waitFor(() => expect(result.current.work).not.toBeNull());
    act(() => result.current.reload());
    await waitFor(() => expect(loadWork).toHaveBeenCalledTimes(2));
  });

  it("names a configuration it could not read", async () => {
    loadWork.mockReset();
    loadWork.mockImplementation(() => Promise.reject(new Error("malformed")));
    const { result } = renderHook(() => useWork());
    await waitFor(() => expect(result.current.failed).toMatch(/malformed/));
  });

  it("clears the failure once a read succeeds", async () => {
    loadWork.mockReset();
    loadWork.mockImplementationOnce(() => Promise.reject(new Error("asleep")));
    const { result } = renderHook(() => useWork());
    await waitFor(() => expect(result.current.failed).not.toBeNull());

    loadWork.mockResolvedValue(work);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.failed).toBeNull());
  });
});

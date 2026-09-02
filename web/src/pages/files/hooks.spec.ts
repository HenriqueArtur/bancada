import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const loadWorktree = vi.fn();
const loadPaths = vi.fn();
vi.mock("@/core/review", async () => {
  const real = await vi.importActual<typeof import("@/core/review")>("@/core/review");
  return {
    ...real,
    loadWorktree: (...a: unknown[]) => loadWorktree(...a),
    loadPaths: (...a: unknown[]) => loadPaths(...a),
  };
});

const { useTracking } = await import("@/pages/files/logic");

const tree = { files: { "src/db.rs": "modified" as const }, dirs: {} };

describe("useTracking", () => {
  it("asks what git says about the tree on arrival", async () => {
    loadWorktree.mockResolvedValueOnce(tree);
    const { result } = renderHook(() => useTracking("bancada", false));
    await waitFor(() => expect(result.current.worktree).toEqual(tree));
    expect(loadWorktree).toHaveBeenCalledWith("bancada");
  });

  it("does not enumerate the tree until somebody types", async () => {
    // In a repository the paths are one `ls-files`; anywhere else they are a
    // walk, and a search box is not a reason to enumerate a tree over an ssh
    // connection before anybody asked a question.
    loadWorktree.mockResolvedValueOnce(tree);
    loadPaths.mockReset();
    const { result } = renderHook(() => useTracking("bancada", false));
    await waitFor(() => expect(result.current.worktree).toEqual(tree));
    expect(loadPaths).not.toHaveBeenCalled();
    expect(result.current.paths).toBeNull();
  });

  it("reads the paths once, when they are wanted", async () => {
    loadWorktree.mockResolvedValue(tree);
    loadPaths.mockReset().mockResolvedValue(["src/db.rs"]);
    const { result, rerender } = renderHook(({ w }) => useTracking("bancada", w), {
      initialProps: { w: true },
    });
    await waitFor(() => expect(result.current.paths).toEqual(["src/db.rs"]));
    rerender({ w: true });
    expect(loadPaths).toHaveBeenCalledTimes(1);
  });

  it("keeps the tree when git has nothing to say about it", async () => {
    // A project git has never been told about still has a tree worth
    // showing; only the colouring has no answer.
    loadWorktree.mockRejectedValueOnce("not a repository");
    const { result } = renderHook(() => useTracking("bancada", false));
    await waitFor(() => expect(result.current.worktree).toEqual({ files: {}, dirs: {} }));
  });

  it("treats an unreadable path list as an empty one", async () => {
    loadWorktree.mockResolvedValue(tree);
    loadPaths.mockReset().mockRejectedValueOnce("no");
    const { result } = renderHook(() => useTracking("bancada", true));
    await waitFor(() => expect(result.current.paths).toEqual([]));
  });
});

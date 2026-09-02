import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Branch, Commit } from "@/core/git";

const loadHistory = vi.fn();
const loadBranches = vi.fn();
vi.mock("@/core/git", async () => {
  const real = await vi.importActual<typeof import("@/core/git")>("@/core/git");
  return {
    ...real,
    loadHistory: (...a: unknown[]) => loadHistory(...a),
    loadBranches: (...a: unknown[]) => loadBranches(...a),
  };
});

const { A_PAGE } = await import("@/core/git");
const { useHistory } = await import("@/pages/git/logic");

const commit = (n: number): Commit => ({
  sha: `sha${n}`,
  short: `s${n}`,
  author: "T",
  when: n,
  subject: `commit ${n}`,
});
const page = (n: number) => Array.from({ length: n }, (_, i) => commit(i));
const main: Branch = { name: "main", head: "abc", current: true };

describe("useHistory", () => {
  it("reads the first page and the branches on arrival", async () => {
    loadHistory.mockResolvedValueOnce(page(2));
    loadBranches.mockResolvedValueOnce([main]);

    const { result } = renderHook(() => useHistory("bancada"));
    await waitFor(() => expect(result.current.commits).toHaveLength(2));
    expect(result.current.branches).toEqual([main]);
    expect(result.current.more).toBe(false);
    expect(loadHistory).toHaveBeenCalledWith("bancada", 0);
  });

  it("knows there is another page without counting the whole history", async () => {
    // The command hands back one more than a page. That extra is the answer
    // to "is there more", and it must not reach the list.
    loadHistory.mockResolvedValueOnce(page(A_PAGE + 1));
    loadBranches.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useHistory("bancada"));
    await waitFor(() => expect(result.current.more).toBe(true));
    expect(result.current.commits).toHaveLength(A_PAGE);
  });

  it("appends the next page rather than replacing what is read", async () => {
    loadHistory.mockResolvedValueOnce(page(A_PAGE + 1));
    loadBranches.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useHistory("bancada"));
    await waitFor(() => expect(result.current.more).toBe(true));

    loadHistory.mockResolvedValueOnce([commit(99)]);
    result.current.further();
    await waitFor(() => expect(result.current.commits).toHaveLength(A_PAGE + 1));
    expect(loadHistory).toHaveBeenLastCalledWith("bancada", A_PAGE);
    expect(result.current.more).toBe(false);
  });

  it("says why when the history cannot be read", async () => {
    loadHistory.mockRejectedValueOnce("not a repository");
    loadBranches.mockRejectedValueOnce("not a repository");

    const { result } = renderHook(() => useHistory("bancada"));
    await waitFor(() => expect(result.current.failed).toContain("not a repository"));
    expect(result.current.loading).toBe(false);
  });

  it("treats no branches as a repository with nothing in it, not a failure", async () => {
    // `git init` and nothing else. The history says so; the branch list has
    // no separate complaint to make.
    loadHistory.mockResolvedValueOnce([]);
    loadBranches.mockRejectedValueOnce("no refs");

    const { result } = renderHook(() => useHistory("bancada"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.branches).toEqual([]);
    expect(result.current.failed).toBeNull();
  });
});

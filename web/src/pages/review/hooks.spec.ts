import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReviewView } from "@/core/review";

const loadReview = vi.fn();
const markSeen = vi.fn();
const unmarkSeen = vi.fn();
vi.mock("@/core/review", async () => {
  const real = await vi.importActual<typeof import("@/core/review")>("@/core/review");
  return {
    ...real,
    loadReview: (...a: unknown[]) => loadReview(...a),
    markSeen: (...a: unknown[]) => markSeen(...a),
    unmarkSeen: (...a: unknown[]) => unmarkSeen(...a),
  };
});

const { useReview } = await import("@/pages/review/logic");

const file = {
  path: "src/db.rs",
  added: 1,
  removed: 0,
  status: "modified" as const,
  from: null,
  fingerprint: "abc",
  fresh: true,
  hunks: [],
};
const view: ReviewView = {
  diff: { files: [file] },
  sessions: [],
  unannounced: [],
  unreachable: null,
};

describe("useReview", () => {
  it("reads the project it was given", async () => {
    loadReview.mockReset().mockResolvedValue(view);
    const { result } = renderHook(() => useReview("bancada"));
    await waitFor(() => expect(result.current.data).toEqual(view));
    expect(loadReview).toHaveBeenCalledWith("bancada");
  });

  it("re-reads when the project changes", async () => {
    loadReview.mockReset().mockResolvedValue(view);
    const { rerender } = renderHook(({ p }) => useReview(p), {
      initialProps: { p: "one" },
    });
    await waitFor(() => expect(loadReview).toHaveBeenCalledWith("one"));
    rerender({ p: "two" });
    await waitFor(() => expect(loadReview).toHaveBeenCalledWith("two"));
  });

  it("vouches for a file at the shape it has, then reads again", async () => {
    // Reading again is the point: the fingerprint it just stored is what
    // makes the row stop saying "new to you", and the row comes from the
    // core rather than from local state.
    loadReview.mockReset().mockResolvedValue(view);
    markSeen.mockReset();
    const { result } = renderHook(() => useReview("bancada"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.vouch(file));
    expect(markSeen).toHaveBeenCalledWith("bancada", "src/db.rs", "abc");
    await waitFor(() => expect(loadReview).toHaveBeenCalledTimes(2));
  });

  it("names a tree it could not read", async () => {
    loadReview.mockReset();
    loadReview.mockImplementation(() => Promise.reject(new Error("not a repository")));
    const { result } = renderHook(() => useReview("bancada"));
    await waitFor(() => expect(result.current.failed).toMatch(/not a repository/));
  });

  it("takes the review back when the file has already been vouched for", async () => {
    // The same control both ways. A checkbox that only ever ticks is a
    // checkbox that lied about being one.
    loadReview.mockReset().mockResolvedValue(view);
    markSeen.mockReset();
    unmarkSeen.mockReset();
    const { result } = renderHook(() => useReview("bancada"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.vouch({ ...file, fresh: false }));
    expect(unmarkSeen).toHaveBeenCalledWith("bancada", "src/db.rs");
    expect(markSeen).not.toHaveBeenCalled();
  });
});

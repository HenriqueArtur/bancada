import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

const { A_PAGE, loadBranches, loadCommit, loadHistory, loadRepo } = await import("@/core/git");

describe("the git seam", () => {
  it("asks for one page at a time, from where the caller stopped", () => {
    loadHistory("bancada", 60);
    expect(invoke).toHaveBeenCalledWith("history", {
      project: "bancada",
      skip: 60,
      take: A_PAGE,
    });
  });

  it("names each command the way the Rust side spells it", () => {
    // A rename on one side of the seam and not the other fails at runtime
    // and nowhere else — there is no type that spans it.
    invoke.mockClear();
    loadRepo("bancada");
    loadBranches("bancada");
    loadCommit("bancada", "f857b4b");
    expect(invoke.mock.calls.map((c) => c[0])).toEqual(["repo", "branches", "commit"]);
    expect(invoke.mock.calls[2][1]).toEqual({ project: "bancada", sha: "f857b4b" });
  });
});

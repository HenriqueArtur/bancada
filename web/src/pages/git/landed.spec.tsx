import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Landed } from "@/core/git";

const loadCommit = vi.fn();
vi.mock("@/core/git", async () => {
  const real = await vi.importActual<typeof import("@/core/git")>("@/core/git");
  return { ...real, loadCommit: (...a: unknown[]) => loadCommit(...a) };
});

class NoScroll {
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", NoScroll);

const { LandedView } = await import("@/pages/git/landed");

const landed: Landed = {
  commit: {
    sha: "f857b4b9",
    short: "f857b4b",
    author: "Henrique Artur",
    when: Math.floor(Date.now() / 1000) - 86_400,
    subject: "🔏 | signed as itself",
  },
  body: "The application had no mark of its own and wore the Tauri default.",
  diff: {
    files: [
      {
        path: "src/db.rs",
        added: 4,
        removed: 1,
        status: "modified",
        from: null,
        fingerprint: "a",
        fresh: true,
        hunks: [
          {
            header: "@@ -1,2 +1,3 @@",
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            lines: [{ kind: "added", text: "  new();" }],
          },
        ],
      },
    ],
  },
};

const show = () => render(<LandedView project="bancada" sha="f857b4b9" onBack={vi.fn()} />);

describe("LandedView", () => {
  it("names the commit, who wrote it and how much it moved", async () => {
    loadCommit.mockResolvedValueOnce(landed);
    show();
    await waitFor(() => expect(screen.getByText("🔏 | signed as itself")).toBeTruthy());
    expect(screen.getByText("Henrique Artur")).toBeTruthy();
    expect(screen.getByText("f857b4b")).toBeTruthy();
    expect(screen.getByText("1 day ago")).toBeTruthy();
    // Twice on purpose: the commit's total in the header, and the file's
    // own count on its card.
    expect(screen.getAllByText("+4")).toHaveLength(2);
  });

  it("offers no way to vouch for history", async () => {
    // Nobody is asked to review a commit that has already landed, and a
    // checkbox that records nothing is worse than none.
    loadCommit.mockResolvedValueOnce(landed);
    show();
    await waitFor(() => expect(screen.getByText("src/db.rs")).toBeTruthy());
    expect(screen.queryByText("Viewed")).toBeNull();
  });

  it("shows the whole message, not the subject alone", async () => {
    // The diff already says what changed. The body is the only place what
    // was considered and dropped is written down.
    loadCommit.mockResolvedValueOnce(landed);
    show();
    await waitFor(() => expect(screen.getByText(/wore the Tauri default/)).toBeTruthy());
  });

  it("says nothing extra for a commit that has only a subject", async () => {
    loadCommit.mockResolvedValueOnce({ ...landed, body: "" });
    show();
    await waitFor(() => expect(screen.getByText("🔏 | signed as itself")).toBeTruthy());
    expect(screen.queryByText(/wore the Tauri default/)).toBeNull();
  });

  it("says why when the commit cannot be read", async () => {
    loadCommit.mockRejectedValueOnce("no commit f857b4b9");
    show();
    await waitFor(() => expect(screen.getByText(/Could not read the commit/)).toBeTruthy());
  });

  it("says so for a commit that changed nothing", async () => {
    loadCommit.mockResolvedValueOnce({ ...landed, body: "", diff: { files: [] } });
    show();
    await waitFor(() => expect(screen.getByText(/changed no files/)).toBeTruthy());
  });

  it("keeps a way back to the history while it is still reading", () => {
    loadCommit.mockReturnValueOnce(new Promise(() => {}));
    show();
    expect(screen.getByText("History")).toBeTruthy();
  });
});

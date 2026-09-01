import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffView } from "./diff-view";
import type { Diff, FileDiff } from "../review";

const file = (over: Partial<FileDiff> = {}): FileDiff => ({
  path: "src/db.rs",
  added: 2,
  removed: 1,
  fingerprint: "abc",
  fresh: true,
  hunks: [
    {
      header: "@@ -1,2 +1,3 @@",
      lines: [
        { kind: "context", text: "fn open() {" },
        { kind: "removed", text: "  old();" },
        { kind: "added", text: "  new();" },
      ],
    },
  ],
  ...over,
});

const diff = (files: FileDiff[]): Diff => ({ files });

describe("DiffView", () => {
  it("says the tree is clean rather than showing nothing", () => {
    render(<DiffView diff={diff([])} unannounced={[]} onSeen={vi.fn()} />);
    expect(screen.getByText(/matches its last commit/)).toBeTruthy();
  });

  it("marks a file no session announced", () => {
    render(
      <DiffView diff={diff([file()])} unannounced={["src/db.rs"]} onSeen={vi.fn()} />,
    );
    expect(screen.getByText("unannounced")).toBeTruthy();
  });

  it("puts the unannounced file above the announced one", () => {
    const files = [
      file({ path: "a-announced.rs", fresh: false }),
      file({ path: "z-surprise.rs", fresh: false }),
    ];
    render(
      <DiffView diff={diff(files)} unannounced={["z-surprise.rs"]} onSeen={vi.fn()} />,
    );
    const shown = screen.getAllByText(/\.rs$/).map((e) => e.textContent);
    expect(shown[0]).toBe("z-surprise.rs");
  });

  it("opens a fresh file and leaves a reviewed one folded", () => {
    render(
      <DiffView
        diff={diff([file({ path: "fresh.rs" }), file({ path: "old.rs", fresh: false })])}
        unannounced={[]}
        onSeen={vi.fn()}
      />,
    );
    // The hunk body of the fresh file is on screen; the reviewed one is not.
    expect(screen.getAllByText("@@ -1,2 +1,3 @@")).toHaveLength(1);
  });

  it("hands back the fingerprint when a file is marked reviewed", () => {
    const onSeen = vi.fn();
    render(<DiffView diff={diff([file()])} unannounced={[]} onSeen={onSeen} />);
    screen.getByText("mark reviewed").click();
    expect(onSeen).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: "abc" }));
  });
});

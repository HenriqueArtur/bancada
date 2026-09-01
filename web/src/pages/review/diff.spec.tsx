import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffView } from "@/pages/review/diff";
import type { Diff, FileDiff } from "@/core/review";

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
    render(<DiffView diff={diff([])} unannounced={[]} onVouch={vi.fn()} />);
    expect(screen.getByText(/matches its last commit/)).toBeTruthy();
  });

  it("marks a file no session announced", () => {
    render(<DiffView diff={diff([file()])} unannounced={["src/db.rs"]} onVouch={vi.fn()} />);
    expect(screen.getByText("Unannounced")).toBeTruthy();
  });

  it("opens a fresh file and leaves a reviewed one folded", () => {
    render(
      <DiffView
        diff={diff([file({ path: "fresh.rs" }), file({ path: "old.rs", fresh: false })])}
        unannounced={[]}
        onVouch={vi.fn()}
      />,
    );
    // Nothing is hidden — the header still names the reviewed file — but
    // the pane opens on what moved.
    expect(screen.getAllByText("@@ -1,2 +1,3 @@")).toHaveLength(1);
  });

  it("hands back the fingerprint when a file is vouched for", () => {
    const onVouch = vi.fn();
    render(<DiffView diff={diff([file()])} unannounced={[]} onVouch={onVouch} />);
    screen.getByText("Mark reviewed").click();
    expect(onVouch).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: "abc" }));
  });
});

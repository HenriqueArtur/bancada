import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FileDiff, Hunk } from "@/core/review";

const loadFile = vi.fn();
vi.mock("@/core/review", async () => {
  const real = await vi.importActual<typeof import("@/core/review")>("@/core/review");
  return { ...real, loadFile: (...a: unknown[]) => loadFile(...a) };
});

// jsdom has no IntersectionObserver, and the header watcher is the only
// thing that wants one. A stub that observes nothing is the right double:
// what it reports is scroll position, which jsdom does not have either.
class NoScroll {
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", NoScroll);

const { FileSection } = await import("@/pages/review/diff");

const hunk = (over: Partial<Hunk> = {}): Hunk => ({
  header: "@@ -1,2 +1,3 @@",
  oldStart: 1,
  oldLines: 2,
  newStart: 1,
  newLines: 3,
  lines: [
    { kind: "context", text: "fn open() {" },
    { kind: "removed", text: "  old();" },
    { kind: "added", text: "  new();" },
  ],
  ...over,
});

const file = (over: Partial<FileDiff> = {}): FileDiff => ({
  path: "src/db.rs",
  added: 2,
  removed: 1,
  status: "modified",
  from: null,
  fingerprint: "abc",
  fresh: true,
  hunks: [hunk()],
  ...over,
});

const show = (over: Partial<FileDiff> = {}, startOpen = true) =>
  render(
    <FileSection
      project="bancada"
      file={file(over)}
      startOpen={startOpen}
      onVouch={vi.fn()}
      onEnter={vi.fn()}
    />,
  );

describe("FileSection", () => {
  it("names the file and counts each side in its own colour", () => {
    show();
    expect(screen.getByText("src/db.rs")).toBeTruthy();
    expect(screen.getByText("+2").className).toContain("text-sage");
    expect(screen.getByText("−1").className).toContain("text-alarm");
  });

  it("says so for a file whose text did not move", () => {
    // A mode change, or a rename with no edit. `git diff` names the file and
    // gives it no hunks.
    show({ hunks: [], added: 0, removed: 0 });
    expect(screen.getByText("no lines")).toBeTruthy();
    expect(screen.getByText(/Nothing in the text of this file changed/)).toBeTruthy();
  });

  it("opens a file you have not seen", () => {
    show();
    expect(screen.getByText("@@ -1,2 +1,3 @@")).toBeTruthy();
  });

  it("arrives folded when the page says so, still named and still counted", () => {
    // Which files arrive folded is the page's call — it is the only thing
    // that can see how much is already drawn. Nothing is hidden either way.
    show({ fresh: false }, false);
    expect(screen.queryByText("@@ -1,2 +1,3 @@")).toBeNull();
    expect(screen.getByText("src/db.rs")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("folds and unfolds on the caret", () => {
    const { container } = show();
    const caret = container.querySelector("button");
    fireEvent.click(caret as Element);
    expect(screen.queryByText("@@ -1,2 +1,3 @@")).toBeNull();
  });

  it("offers viewed as something you can take back", () => {
    const onVouch = vi.fn();
    render(<FileSection project="bancada" file={file()} onVouch={onVouch} onEnter={vi.fn()} />);
    const box = screen.getByText("Viewed").closest("button");
    expect(box?.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(box as Element);
    expect(onVouch).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: "abc" }));
  });

  it("shows viewed as pressed once the file has been vouched for", () => {
    show({ fresh: false });
    expect(screen.getByText("Viewed").closest("button")?.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("holds back a file too large to read, and opens it on request", () => {
    show({ added: 900, removed: 0 });
    expect(screen.queryByText("@@ -1,2 +1,3 @@")).toBeNull();
    fireEvent.click(screen.getByText("Show it anyway"));
    expect(screen.getByText("@@ -1,2 +1,3 @@")).toBeTruthy();
  });

  it("offers the unchanged lines above a hunk that does not start the file", () => {
    show({ hunks: [hunk({ newStart: 20, oldStart: 20 })] });
    expect(screen.getByText(/19 unchanged lines/)).toBeTruthy();
  });

  it("offers nothing above a hunk that starts at line one", () => {
    show();
    expect(screen.queryByText(/unchanged line/)).toBeNull();
  });

  it("reads the file out of the tree when the gap is opened", async () => {
    loadFile.mockResolvedValueOnce("one\ntwo\nthree\nfour");
    show({ hunks: [hunk({ newStart: 4, oldStart: 4 })] });
    fireEvent.click(screen.getByText(/3 unchanged lines/));
    await waitFor(() => expect(screen.getByText(/two/)).toBeTruthy());
    expect(loadFile).toHaveBeenCalledWith("bancada", "src/db.rs");
  });

  it("says why when the file cannot be read to expand it", async () => {
    // The diff was read a moment ago and the tree has moved since. The hunks
    // are still worth showing; only the expansion is gone.
    loadFile.mockRejectedValueOnce("no such file");
    show({ hunks: [hunk({ newStart: 4, oldStart: 4 })] });
    fireEvent.click(screen.getByText(/3 unchanged lines/));
    await waitFor(() => expect(screen.getByText(/Could not read the file/)).toBeTruthy());
    expect(screen.getByText("@@ -1,2 +1,3 @@")).toBeTruthy();
  });
});

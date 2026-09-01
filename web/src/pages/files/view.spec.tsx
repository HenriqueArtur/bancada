import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const loadFile = vi.fn();
vi.mock("@/core/review", async () => {
  const real = await vi.importActual<typeof import("@/core/review")>("@/core/review");
  return {
    ...real,
    loadFile: (...a: unknown[]) => loadFile(...a),
    loadTree: () => Promise.resolve([]),
  };
});

const create = vi.fn();
const defineTheme = vi.fn();
const dispose = vi.fn();

/// jsdom cannot lay out an editor, so Monaco is answered rather than run.
/// What is worth checking is everything around it: which theme it was built
/// with, that it is disposed, and what shows when it will not load at all.
vi.mock("monaco-editor/esm/vs/editor/editor.main", () => ({
  editor: {
    defineTheme: (...a: unknown[]) => defineTheme(...a),
    create: (...a: unknown[]) => {
      create(...a);
      return { dispose };
    },
  },
}));

const { CodeView } = await import("@/pages/files/code");

describe("CodeView", () => {
  it("asks for nothing until a file is picked", () => {
    loadFile.mockReset();
    render(<CodeView project="p" path={null} />);
    expect(screen.getByText("Pick a file.")).toBeTruthy();
    expect(loadFile).not.toHaveBeenCalled();
  });

  it("says it is reading before it has anything", () => {
    loadFile.mockReset().mockImplementation(() => new Promise(() => {}));
    render(<CodeView project="p" path="a.rs" />);
    expect(screen.getByText("Reading…")).toBeTruthy();
  });

  it("names a file it could not read rather than showing it empty", async () => {
    // "binary file", "too large", "outside the project" — each is a
    // sentence the command already wrote, and losing it leaves a blank pane.
    loadFile.mockReset();
    loadFile.mockImplementation(() => Promise.reject(new Error("binary file")));
    render(<CodeView project="p" path="logo.png" />);
    expect(await screen.findByText(/binary file/)).toBeTruthy();
  });

  it("builds the editor with the file's language and the page's palette", async () => {
    loadFile.mockReset().mockResolvedValue("fn main() {}\n");
    create.mockReset();
    defineTheme.mockReset();
    render(<CodeView project="p" path="src/db.rs" />);

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(defineTheme).toHaveBeenCalledWith(
      "bancada",
      expect.objectContaining({ inherit: false }),
    );
    const options = create.mock.calls[0][1];
    expect(options).toMatchObject({
      language: "rust",
      readOnly: true,
      theme: "bancada",
      // A reading pane, not an editing one: a line that runs off the edge
      // is a line nobody reviewed.
      wordWrap: "on",
      fontSize: 13,
    });
  });

  it("disposes the editor when the pane goes away", async () => {
    loadFile.mockReset().mockResolvedValue("x\n");
    // Both, or `waitFor` is satisfied by the previous test's call and the
    // unmount happens before this editor exists.
    create.mockReset();
    dispose.mockReset();
    const { unmount } = render(<CodeView project="p" path="a.rs" />);
    await waitFor(() => expect(create).toHaveBeenCalled());
    unmount();
    expect(dispose).toHaveBeenCalled();
  });
});

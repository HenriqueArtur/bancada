import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Entry } from "../review";

const loadTree = vi.fn();
vi.mock("../review", () => ({ loadTree: (...a: unknown[]) => loadTree(...a) }));

const { FileTree } = await import("./file-tree");

const entry = (path: string, isDir = false): Entry => ({
  path,
  name: path.split("/").pop()!,
  isDir,
});

/// Answers by argument rather than by call order.
///
/// `mockResolvedValueOnce` would make each test depend on how many calls the
/// ones before it made. Dispatching on `sub` is stabler and closer to what
/// the real command does.
///
/// There is deliberately **no `beforeEach`** here. With one present, vitest
/// reports the rejection in the last test as unhandled — the hook shifts the
/// tick on which it scans, to before the component's effect attaches its
/// `.catch`. Each test sets the implementation it needs, so nothing is
/// carried between them anyway.
const serving = (byDir: Record<string, Entry[]>) =>
  loadTree.mockImplementation((_project: string, sub?: string) =>
    Promise.resolve(byDir[sub ?? ""] ?? []),
  );

describe("FileTree", () => {

  it("asks for the project root, not for a path", async () => {
    serving({});
    render(<FileTree project="neo-gitmoji" onOpen={vi.fn()} selected={null} />);
    await waitFor(() =>
      expect(loadTree).toHaveBeenCalledWith("neo-gitmoji", undefined),
    );
  });

  it("does not read a directory until it is opened", async () => {
    serving({ "": [entry("src", true)] });
    loadTree.mockClear();
    render(<FileTree project="p" onOpen={vi.fn()} selected={null} />);
    await screen.findByText(/src/);
    // One call — the root. A tree that walked eagerly would already have
    // asked for `src` too, and for everything under it.
    expect(loadTree).toHaveBeenCalledTimes(1);
  });

  it("reads a directory once it is expanded, by its full relative path", async () => {
    serving({ "": [entry("src", true)], src: [entry("src/db.rs")] });
    render(<FileTree project="p" onOpen={vi.fn()} selected={null} />);
    fireEvent.click(await screen.findByText(/src/));
    await waitFor(() => expect(loadTree).toHaveBeenCalledWith("p", "src"));
    expect(await screen.findByText("db.rs")).toBeTruthy();
  });

  it("hands the caller the path relative to the project, not the name", async () => {
    const onOpen = vi.fn();
    serving({ "": [entry("src/db.rs")] });
    render(<FileTree project="p" onOpen={onOpen} selected={null} />);
    fireEvent.click(await screen.findByText("db.rs"));
    expect(onOpen).toHaveBeenCalledWith("src/db.rs");
  });


  it("names a directory it could not read rather than showing it empty", async () => {
    loadTree.mockImplementation(() =>
      Promise.reject(new Error("permission denied")),
    );
    render(<FileTree project="p" onOpen={vi.fn()} selected={null} />);
    expect(await screen.findByText(/permission denied/)).toBeTruthy();
  });
});

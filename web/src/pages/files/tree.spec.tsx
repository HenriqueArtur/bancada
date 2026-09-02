import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Entry, Worktree } from "@/core/review";

const loadTree = vi.fn();
vi.mock("@/core/review", () => ({ loadTree: (...a: unknown[]) => loadTree(...a) }));

const { FileTree } = await import("@/pages/files/tree");

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
const NOTHING: Worktree = { files: {}, dirs: {} };

/// The tree with everything it needs, so a test only names what it is about.
const show = (over: Partial<Parameters<typeof FileTree>[0]> = {}) =>
  render(
    <FileTree
      project="neo-gitmoji"
      onOpen={vi.fn()}
      selected={null}
      worktree={NOTHING}
      paths={null}
      query=""
      onQuery={vi.fn()}
      {...over}
    />,
  );

const serving = (byDir: Record<string, Entry[]>) =>
  loadTree.mockImplementation((_project: string, sub?: string) =>
    Promise.resolve(byDir[sub ?? ""] ?? []),
  );

describe("FileTree", () => {
  it("asks for the project root, not for a path", async () => {
    serving({});
    show({ onOpen: vi.fn(), selected: null });
    await waitFor(() => expect(loadTree).toHaveBeenCalledWith("neo-gitmoji", undefined));
  });

  it("does not read a directory until it is opened", async () => {
    serving({ "": [entry("src", true)] });
    loadTree.mockClear();
    show({ project: "p", onOpen: vi.fn() });
    await screen.findByText(/src/);
    // One call — the root. A tree that walked eagerly would already have
    // asked for `src` too, and for everything under it.
    expect(loadTree).toHaveBeenCalledTimes(1);
  });

  it("reads a directory once expanded, by its full relative path", async () => {
    serving({ "": [entry("src", true)], src: [entry("src/db.rs")] });
    show({ project: "p", onOpen: vi.fn() });
    fireEvent.click(await screen.findByText(/src/));
    await waitFor(() => expect(loadTree).toHaveBeenCalledWith("p", "src"));
    expect(await screen.findByText("db.rs")).toBeTruthy();
  });

  it("hands the caller the path relative to the project, not the name", async () => {
    const onOpen = vi.fn();
    serving({ "": [entry("src/db.rs")] });
    show({ project: "p", onOpen: onOpen });
    fireEvent.click(await screen.findByText("db.rs"));
    expect(onOpen).toHaveBeenCalledWith("src/db.rs");
  });

  it("names a directory it could not read rather than showing it empty", async () => {
    loadTree.mockImplementation(() => Promise.reject(new Error("permission denied")));
    show({ project: "p", onOpen: vi.fn() });
    expect(await screen.findByText(/permission denied/)).toBeTruthy();
  });

  it("colours a file by what git says about it, with a letter beside it", async () => {
    // The editor's convention. Anybody who has used VS Code already knows a
    // green U is untracked, and a second vocabulary for the same six states
    // buys nothing but the cost of learning it.
    serving({ "": [entry("new.rs")] });
    show({ project: "p", worktree: { files: { "new.rs": "untracked" }, dirs: {} } });
    const name = await screen.findByText("new.rs");
    expect(name.className).toContain("text-sage");
    expect(screen.getByTitle("Untracked").textContent).toBe("U");
  });

  it("colours a closed folder by what changed inside it", async () => {
    // A closed folder that says nothing is a folder you have to open to
    // learn anything, which is most of the reason to colour a tree.
    serving({ "": [entry("src", true)] });
    show({ project: "p", worktree: { files: { "src/db.rs": "modified" }, dirs: {} } });
    expect((await screen.findByText("src")).className).toContain("text-clay");
  });

  it("dims an ignored directory and gives it no letter", async () => {
    // It is already grey. A badge would hand the row it dims the loudest
    // mark in the column.
    serving({ "": [entry("target", true)] });
    show({ project: "p", worktree: { files: {}, dirs: { target: "ignored" } } });
    expect((await screen.findByText("target")).className).toContain("text-ink-faint");
    expect(screen.queryByTitle("Ignored")).toBeNull();
  });

  it("shows matches instead of the tree while you are searching", async () => {
    serving({ "": [entry("kept.rs")] });
    show({
      project: "p",
      query: "db",
      paths: ["src/db.rs", "src/other.rs"],
    });
    expect(await screen.findByText("db.rs")).toBeTruthy();
    expect(screen.queryByText("kept.rs")).toBeNull();
  });

  it("says a search found nothing rather than showing an empty column", async () => {
    serving({ "": [] });
    show({ project: "p", query: "nothing-like-this", paths: ["src/db.rs"] });
    expect(await screen.findByText("No file matches.")).toBeTruthy();
  });

  it("waits for the paths before claiming a search found nothing", async () => {
    // They are fetched only once somebody types. Between the keystroke and
    // the answer, "no file matches" would be a lie.
    serving({ "": [] });
    show({ project: "p", query: "db", paths: null });
    expect(await screen.findByText(/Reading the tree/)).toBeTruthy();
  });

  it("reports what was typed into the search", async () => {
    const onQuery = vi.fn();
    serving({ "": [] });
    show({ project: "p", onQuery });
    fireEvent.change(screen.getByLabelText("Find a file by path"), {
      target: { value: "core" },
    });
    expect(onQuery).toHaveBeenCalledWith("core");
  });
});

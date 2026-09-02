import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChangedFiles, FilterPanel } from "@/pages/review/changed";
import { NOTHING_FILTERED } from "@/pages/review/logic";
import type { FileDiff, Status } from "@/core/review";

const file = (path: string, over: Partial<FileDiff> = {}): FileDiff => ({
  path,
  added: 3,
  removed: 1,
  status: "modified" as Status,
  from: null,
  fingerprint: path,
  fresh: false,
  hunks: [],
  ...over,
});

const files = [
  file("crates/bancada-core/src/diff.rs", { status: "added" }),
  file("web/src/pages/review/diff.tsx", { fresh: true }),
  file("web/src/pages/review/logic.ts"),
  file("README.md"),
];

const show = (over: Partial<Parameters<typeof ChangedFiles>[0]> = {}) =>
  render(
    <ChangedFiles
      files={files}
      filters={NOTHING_FILTERED}
      onFilters={vi.fn()}
      at={null}
      onGoTo={vi.fn()}
      {...over}
    />,
  );

describe("ChangedFiles", () => {
  it("nests the files under their directories", () => {
    show();
    expect(screen.getByText("web/src/pages/review")).toBeTruthy();
    expect(screen.getByText("diff.tsx")).toBeTruthy();
  });

  it("joins a directory chain that holds nothing but the next one", () => {
    // `crates` and `bancada-core` and `src` each hold one thing. Three rows
    // to reach one file is three clicks spent on scenery.
    show();
    expect(screen.getByText("crates/bancada-core/src")).toBeTruthy();
  });

  it("puts a file at the repository root at the top, ungrouped", () => {
    show();
    expect(screen.getByText("README.md")).toBeTruthy();
  });

  it("opens every directory, and closing one hides what is under it", () => {
    show();
    fireEvent.click(screen.getByText("web/src/pages/review"));
    expect(screen.queryByText("diff.tsx")).toBeNull();
    expect(screen.getByText("README.md")).toBeTruthy();
  });

  it("scrolls to a file rather than selecting it", () => {
    const onGoTo = vi.fn();
    show({ onGoTo });
    fireEvent.click(screen.getByText("README.md"));
    expect(onGoTo).toHaveBeenCalledWith("README.md");
  });

  it("says which file the page is on without having been told twice", () => {
    show({ at: "README.md" });
    expect(screen.getByText("README.md").closest("button")?.getAttribute("aria-current")).toBe(
      "true",
    );
  });

  it("names each status for anybody who cannot read the icon", () => {
    show({ files: [file("gone.ts", { status: "deleted" })] });
    expect(screen.getByTitle("Deleted")).toBeTruthy();
  });

  it("says where a renamed file came from", () => {
    show({
      files: [file("new.ts", { status: "renamed", from: "old.ts" })],
    });
    expect(screen.getByTitle("Renamed from old.ts")).toBeTruthy();
  });

  it("shows only what the search leaves", () => {
    show({ filters: { ...NOTHING_FILTERED, query: "readme" } });
    expect(screen.getByText("README.md")).toBeTruthy();
    expect(screen.queryByText("diff.rs")).toBeNull();
  });

  it("reports what was typed into the search", () => {
    const onFilters = vi.fn();
    show({ onFilters });
    fireEvent.change(screen.getByLabelText("Filter by path"), { target: { value: "core" } });
    expect(onFilters).toHaveBeenCalledWith(expect.objectContaining({ query: "core" }));
  });

  it("says a search found nothing rather than showing an empty column", () => {
    show({ filters: { ...NOTHING_FILTERED, query: "nothing-like-this" } });
    expect(screen.getByText("Nothing matches.")).toBeTruthy();
  });

  it("says a clean tree differently, because it is different news", () => {
    show({ files: [] });
    expect(screen.getByText(/matches its last commit/)).toBeTruthy();
  });
});

describe("the filter panel", () => {
  // Rendered without its popover. The wiring below is this file's; the
  // portal it lives in is Radix's, and driving one to reach the other costs
  // the suite twelve seconds a spec under jsdom.
  const open = (over: Partial<Parameters<typeof FilterPanel>[0]> = {}) =>
    render(
      <FilterPanel files={files} filters={NOTHING_FILTERED} onFilters={vi.fn()} {...over} />,
    );

  it("offers only the extensions this change actually has", () => {
    open();
    expect(screen.getByText(".tsx")).toBeTruthy();
    expect(screen.queryByText(".py")).toBeNull();
  });

  it("counts each extension", () => {
    open();
    expect(screen.getByText(".ts").closest("button")?.textContent).toContain("1");
  });

  it("turning one extension off leaves the rest on", () => {
    const onFilters = vi.fn();
    open({ onFilters });
    fireEvent.click(screen.getByText(".rs"));
    expect(onFilters).toHaveBeenCalledWith(
      expect.objectContaining({ exts: expect.not.arrayContaining([".rs"]) }),
    );
  });

  it("turning the last one back on means every kind, not a list of all of them", () => {
    // The difference bites when a file of a new kind appears: an explicit
    // list would not contain it and it would vanish unasked.
    const onFilters = vi.fn();
    open({ onFilters, filters: { ...NOTHING_FILTERED, exts: [".tsx", ".ts", ".md"] } });
    fireEvent.click(screen.getByText(".rs"));
    expect(onFilters).toHaveBeenCalledWith(expect.objectContaining({ exts: null }));
  });

  it("carries the switches GitHub has", () => {
    const onFilters = vi.fn();
    open({ onFilters });
    fireEvent.click(screen.getByText("Hide viewed"));
    expect(onFilters).toHaveBeenCalledWith(expect.objectContaining({ hideViewed: true }));
  });

  it("offers nothing to clear until something is set", () => {
    open();
    expect(screen.queryByText("Clear filters")).toBeNull();
  });

  it("offers to clear once something is set", () => {
    open({ filters: { ...NOTHING_FILTERED, hideViewed: true } });
    expect(screen.getByText("Clear filters")).toBeTruthy();
  });

  it("clearing keeps the word you are still typing", () => {
    // The search is in your hand, not a setting you forgot. Wiping it from
    // in here would take back something typed a second ago.
    const onFilters = vi.fn();
    open({ onFilters, filters: { ...NOTHING_FILTERED, hideViewed: true, query: "core" } });
    fireEvent.click(screen.getByText("Clear filters"));
    expect(onFilters).toHaveBeenCalledWith({ ...NOTHING_FILTERED, query: "core" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOWHERE, recall, remember } from "@/core/place";

const KNOWN = ["bancada", "archwarden"];

describe("where you were", () => {
  beforeEach(() => localStorage.clear());

  it("opens at the queue when nothing was kept", () => {
    expect(recall(KNOWN)).toEqual(NOWHERE);
  });

  it("comes back to the screen you left, in the project you left it in", () => {
    remember({ place: { at: "changes", project: "bancada" }, chat: true });
    expect(recall(KNOWN)).toEqual({
      place: { at: "changes", project: "bancada" },
      chat: true,
    });
  });

  it("comes back to a screen that is not inside a project", () => {
    remember({ place: { at: "work" }, chat: false });
    expect(recall(KNOWN).place).toEqual({ at: "work" });
  });

  it("refuses a project that is no longer registered, keeping the panel", () => {
    // Reopening onto a diff of something you removed last week is a window
    // whose first act is an error about a name you no longer recognise.
    remember({ place: { at: "files", project: "gone" }, chat: true });
    expect(recall(KNOWN)).toEqual({ place: { at: "cockpit" }, chat: true });
  });

  it("refuses a screen this build no longer has", () => {
    localStorage.setItem(
      "bancada.place",
      JSON.stringify({ place: { at: "said", project: "bancada" }, chat: false }),
    );
    expect(recall(KNOWN)).toEqual(NOWHERE);
  });

  it("ignores a way back that an older build recorded", () => {
    // `from` used to say which list you opened the project from. The way
    // back is the queue now, always, and a leftover field is not a reason
    // to throw away a place that is otherwise still good.
    localStorage.setItem(
      "bancada.place",
      JSON.stringify({
        place: { at: "git", project: "bancada", from: "work" },
        chat: false,
      }),
    );
    expect(recall(KNOWN).place).toEqual({ at: "git", project: "bancada" });
  });

  it("treats a half-written record as nothing kept", () => {
    localStorage.setItem("bancada.place", JSON.stringify({ chat: true }));
    expect(recall(KNOWN)).toEqual(NOWHERE);
  });

  it("treats unreadable storage as nothing kept", () => {
    localStorage.setItem("bancada.place", "{not json");
    expect(recall(KNOWN)).toEqual(NOWHERE);
  });

  it("opens somewhere even when the window cannot remember at all", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(recall(KNOWN)).toEqual(NOWHERE);
    getItem.mockRestore();
  });

  it("survives being unable to keep anything", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => remember(NOWHERE)).not.toThrow();
    setItem.mockRestore();
  });
});

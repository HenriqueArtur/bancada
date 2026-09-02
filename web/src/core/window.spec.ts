import { describe, expect, it, vi } from "vitest";

const setTitle = vi.fn();
const getCurrentWindow = vi.fn(() => ({ setTitle }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => getCurrentWindow() }));

const { name, titleOf } = await import("@/core/window");

describe("titleOf", () => {
  it("puts what is waiting first, where a switcher truncates last", () => {
    // ⌘⇥ and Mission Control show the beginning of the line. The beginning
    // has to carry what the product exists to say.
    expect(titleOf(3, "bancada", "Files changed")).toBe("3 waiting · bancada · Files changed");
  });

  it("says nothing about waiting when nothing is", () => {
    expect(titleOf(0, "bancada", "Files changed")).toBe("bancada · Files changed");
  });

  it("names only the place when you are not inside a project", () => {
    // "Needs you · Needs you" is what naming the screen twice would give.
    expect(titleOf(0, null, "Needs you")).toBe("Needs you");
    expect(titleOf(2, null, "Your work")).toBe("2 waiting · Your work");
  });

  it("never leaves the window unnamed", () => {
    expect(titleOf(0, null, "Needs you")).not.toBe("");
  });
});

describe("name", () => {
  it("tells the window what it is showing", () => {
    name("3 waiting · bancada · Files changed");
    expect(setTitle).toHaveBeenCalledWith("3 waiting · bancada · Files changed");
  });

  it("says nothing when there is no window to tell", () => {
    // The probe page runs these components in a plain browser. A screen that
    // refused to render because it could not rename a window it does not
    // have has misjudged what matters.
    getCurrentWindow.mockImplementationOnce(() => {
      throw new Error("not a tauri window");
    });
    expect(() => name("anything")).not.toThrow();
  });
});

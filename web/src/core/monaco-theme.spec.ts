import { describe, expect, it } from "vitest";
import { definition, paletteFor } from "@/core/monaco-theme";

describe("the editor's palette", () => {
  it("colours the same tokens in both, or one of them is invisible", () => {
    // A token coloured in one theme and left to Monaco's default in the
    // other is unreadable in exactly one of them, which is the kind of bug
    // nobody sees until somebody else's laptop.
    const light = definition(paletteFor(false)).rules.map((r) => r.token);
    const dark = definition(paletteFor(true)).rules.map((r) => r.token);
    expect(light).toEqual(dark);
  });

  it("paints the editor's own ground, not Monaco's", () => {
    // Left unset, the pane keeps `vs-dark`'s blue-black and reads as a
    // different program embedded in this one.
    expect(definition(paletteFor(false)).colors["editor.background"]).toBe("#faf9f5");
    expect(definition(paletteFor(true)).colors["editor.background"]).toBe("#21201d");
  });

  it("inherits, so an unlisted token still has a colour", () => {
    expect(definition(paletteFor(true)).inherit).toBe(true);
  });
});

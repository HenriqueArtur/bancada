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

  it("inherits nothing, so no stock colour can leak in", () => {
    // With `inherit: true` every family the rules do not name kept the stock
    // colour, and the generated CSS carried `#af00db` and `#dd0000` beside
    // clay and sage. Half a palette reads as a bug rather than as a choice.
    expect(definition(paletteFor(true)).inherit).toBe(false);
  });

  it("names every family the bundled grammars emit", () => {
    // Anything unlisted now falls back to `editor.foreground`, which is
    // right — but a family that *should* have a colour and does not is
    // invisible rather than merely plain.
    const named = new Set(definition(paletteFor(false)).rules.map((r) => r.token));
    for (const t of ["comment", "string", "keyword", "keyword.type", "number", "type",
                     "delimiter", "operator", "identifier", "annotation", "invalid"]) {
      expect(named, `${t} is uncoloured`).toContain(t);
    }
  });

  it("paints the bracket levels in ink rather than in a rainbow", () => {
    // Bracket pair colorization is a separate feature with its own
    // primaries, and the editor option that disables it is ignored in this
    // version. The theme is the only place left to say no.
    const { colors } = definition(paletteFor(false));
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(colors[`editorBracketHighlight.foreground${n}`]).toBe("#1d1c1a");
    }
  });
});

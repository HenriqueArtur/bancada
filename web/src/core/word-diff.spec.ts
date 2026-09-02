import { describe, expect, it } from "vitest";
import { paint, within } from "@/core/word-diff";
import type { Line } from "@/core/review";

const line = (kind: Line["kind"], text: string): Line => ({ kind, text });

/// What a segment list reads as, with the changed parts in brackets.
const show = (parts?: { text: string; changed: boolean }[] | null) =>
  parts == null ? null : parts.map((p) => (p.changed ? `[${p.text}]` : p.text)).join("");

describe("within", () => {
  it("marks the word that changed and leaves the rest alone", () => {
    const got = within("let total = count + 1;", "let total = amount + 1;");
    expect(show(got?.[0])).toBe("let total = [count] + 1;");
    expect(show(got?.[1])).toBe("let total = [amount] + 1;");
  });

  it("marks an insertion on the added side only", () => {
    const got = within("call(a)", "call(a, b)");
    expect(show(got?.[0])).toBe("call(a)");
    expect(show(got?.[1])).toBe("call(a[, b])");
  });

  it("joins neighbouring changed tokens into one mark", () => {
    // Per token this is three marks with unmarked gaps; the reader sees one
    // change, so it should be one box.
    const got = within("x = foo.bar();", "x = qux.baz();");
    expect(show(got?.[1])).toBe("x = [qux].[baz]();");
  });

  it("marks a change in indentation rather than swallowing it", () => {
    const got = within("  return x;", "    return x;");
    expect(show(got?.[1])).toBe("[    ]return x;");
  });

  it("refuses two lines that merely sit next to each other", () => {
    // They share `(`, `)` and `;`. Marking that scatters colour across both
    // lines and teaches the reader that the colour means nothing.
    expect(within("close(handle);", "let widths = measure(all, of, it);")).toBeNull();
  });

  it("does not treat shared indentation as evidence the lines correspond", () => {
    // Two different fields of the same struct. The four spaces, `pub`, the
    // colon and the comma were once enough to clear the threshold, and the
    // pane marked a correspondence that does not exist. Deep in a nested
    // block the indent alone can be most of the line.
    expect(within("    pub lines: Vec<Line>,", "    pub old_start: usize,")).toBeNull();
  });

  it("still marks a rename that happens to be deeply indented", () => {
    const got = within("            call(before);", "            call(after);");
    expect(show(got?.[1])).toBe("            call([after]);");
  });

  it("refuses a line too long to align without stalling the window", () => {
    const huge = Array.from({ length: 300 }, (_, i) => `t${i}`).join(" ");
    expect(within(huge, `${huge} tail`)).toBeNull();
  });

  it("refuses an empty side, which has nothing to point at", () => {
    expect(within("", "something")).toBeNull();
    expect(within("something", "")).toBeNull();
  });

  it("refuses a pair that differs in nothing a token can see", () => {
    expect(within("same", "same")).toBeNull();
  });
});

describe("paint", () => {
  it("pairs each removed line with the added line that replaced it", () => {
    const got = paint([
      line("context", "fn open() {"),
      line("removed", "    let a = one();"),
      line("removed", "    let b = two();"),
      line("added", "    let a = ONE();"),
      line("added", "    let b = TWO();"),
    ]);
    expect(show(got[1].parts)).toBe("    let a = [one]();");
    expect(show(got[3].parts)).toBe("    let a = [ONE]();");
    expect(show(got[2].parts)).toBe("    let b = [two]();");
    expect(show(got[4].parts)).toBe("    let b = [TWO]();");
  });

  it("leaves context lines untouched", () => {
    const got = paint([line("context", "fn open() {"), line("added", "    x();")]);
    expect(got[0].parts).toBeNull();
  });

  it("leaves a removal with nothing to compare against unpainted", () => {
    const got = paint([line("removed", "gone();"), line("context", "kept();")]);
    expect(got[0].parts).toBeNull();
  });

  it("pairs only the overlap when the two runs are different lengths", () => {
    // Three lines became one. The first pair is a real correspondence; the
    // other two removals have no counterpart, and inventing one for them
    // would mark the wrong words.
    const got = paint([
      line("removed", "let a = 1;"),
      line("removed", "let b = 2;"),
      line("removed", "let c = 3;"),
      line("added", "let a = 9;"),
    ]);
    expect(show(got[0].parts)).toBe("let a = [1];");
    expect(got[1].parts).toBeNull();
    expect(got[2].parts).toBeNull();
  });

  it("handles a hunk that is nothing but additions", () => {
    const got = paint([line("added", "one();"), line("added", "two();")]);
    expect(got.every((l) => l.parts === null)).toBe(true);
  });

  it("carries every line through in order, painted or not", () => {
    const lines = [line("context", "a"), line("removed", "b"), line("added", "c")];
    expect(paint(lines).map((l) => [l.kind, l.text])).toEqual([
      ["context", "a"],
      ["removed", "b"],
      ["added", "c"],
    ]);
  });

  it("survives an empty hunk", () => {
    expect(paint([])).toEqual([]);
  });
});

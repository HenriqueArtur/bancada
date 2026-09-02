import { describe, expect, it } from "vitest";
import { type Block, marks, prose } from "@/core/prose";

/// Narrow to the shape a test is about, loudly rather than by cast.
const spansOf = (b: Block) => {
  if (b.kind !== "para" && b.kind !== "quote") throw new Error(`${b.kind} has no spans`);
  return b.spans;
};
const itemsOf = (b: Block) => {
  if (b.kind !== "bullet") throw new Error(`${b.kind} has no items`);
  return b.items;
};
const textOf = (b: Block) => {
  if (b.kind !== "code") throw new Error(`${b.kind} has no text`);
  return b.text;
};

/// What a span list reads as, with each mark in brackets.
const show = (spans: { text: string; bold?: boolean; italic?: boolean; code?: boolean }[]) =>
  spans
    .map((s) =>
      s.bold ? `**${s.text}**` : s.italic ? `_${s.text}_` : s.code ? `\`${s.text}\`` : s.text,
    )
    .join("");

describe("marks", () => {
  it("finds bold", () => {
    expect(show(marks("the **whole** thing"))).toBe("the **whole** thing");
    expect(marks("the **whole** thing")[1]).toEqual({ text: "whole", bold: true });
  });

  it("finds code, and leaves what is inside it alone", () => {
    // `**ptr` in a C snippet is a pointer. A parser that read bold inside a
    // backtick would eat the rest of the sentence looking for its pair.
    const got = marks("call `foo(**ptr)` twice");
    expect(got[1]).toEqual({ text: "foo(**ptr)", code: true });
    expect(got).toHaveLength(3);
  });

  it("finds italics both ways round", () => {
    expect(marks("*this*")[0]).toEqual({ text: "this", italic: true });
    expect(marks("_this_")[0]).toEqual({ text: "this", italic: true });
  });

  it("prefers bold to italic when both could match", () => {
    expect(marks("**both**")[0]).toEqual({ text: "both", bold: true });
  });

  it("keeps the text between marks", () => {
    expect(show(marks("a **b** c `d` e"))).toBe("a **b** c `d` e");
  });

  it("leaves plain text as one span", () => {
    expect(marks("nothing to see")).toEqual([{ text: "nothing to see" }]);
  });

  it("leaves an unclosed mark as the punctuation it is", () => {
    expect(marks("two ** stars")).toEqual([{ text: "two ** stars" }]);
  });

  it("has nothing to say about nothing", () => {
    expect(marks("")).toEqual([]);
  });
});

describe("prose", () => {
  it("unwraps the seventy-two column wrap inside a paragraph", () => {
    // Preserved, the hard wrap puts a ragged edge down the middle of a wide
    // pane. This is the whole reason the function exists.
    const got = prose("The application had no mark of its own\nand wore the Tauri default.");
    expect(got).toHaveLength(1);
    expect(show(spansOf(got[0]))).toBe(
      "The application had no mark of its own and wore the Tauri default.",
    );
  });

  it("keeps paragraphs apart", () => {
    const got = prose("First one.\nStill first.\n\nSecond one.");
    expect(got).toHaveLength(2);
    expect(got.every((b) => b.kind === "para")).toBe(true);
  });

  it("reads a bullet list as a list", () => {
    const got = prose("Two things:\n\n- the first\n- the second\n");
    expect(got[1].kind).toBe("bullet");
    expect(itemsOf(got[1])).toHaveLength(2);
  });

  it("joins a bullet that wrapped onto the next line", () => {
    const got = prose("- one bullet that ran\n  onto a second line\n- another\n");
    const items = itemsOf(got[0]);
    expect(show(items[0])).toBe("one bullet that ran onto a second line");
    expect(items).toHaveLength(2);
  });

  it("accepts every bullet character people actually type", () => {
    for (const c of ["-", "*", "+"]) {
      expect(prose(`${c} a\n${c} b\n`)[0].kind).toBe("bullet");
    }
  });

  it("keeps a fenced block exactly as written", () => {
    // Wrapping code is how a command somebody meant to copy stops being one.
    const got = prose("Run this:\n\n```sh\nmake check\n  --hard\n```\n\nThen look.");
    expect(got.map((b) => b.kind)).toEqual(["para", "code", "para"]);
    expect(textOf(got[1])).toBe("make check\n  --hard");
  });

  it("survives a fence nobody closed", () => {
    const got = prose("```\nstill code\n");
    expect(got).toHaveLength(1);
    expect(textOf(got[0])).toBe("still code");
  });

  it("reads a quoted line as a quotation", () => {
    const got = prose("> the reviewer said\n> two lines of it\n");
    expect(got[0].kind).toBe("quote");
    expect(show(spansOf(got[0]))).toBe("the reviewer said two lines of it");
  });

  it("does not swallow a list into the paragraph above it", () => {
    const got = prose("Two things:\n- one\n- two\n");
    expect(got.map((b) => b.kind)).toEqual(["para", "bullet"]);
  });

  it("takes the marks inside a paragraph with it", () => {
    const got = prose("The **whole** thing, and `make check`.");
    expect(show(spansOf(got[0]))).toBe("The **whole** thing, and `make check`.");
  });

  it("reads windows line endings", () => {
    expect(prose("one\r\n\r\ntwo")).toHaveLength(2);
  });

  it("has no blocks for an empty message", () => {
    expect(prose("")).toEqual([]);
    expect(prose("\n\n  \n")).toEqual([]);
  });
});

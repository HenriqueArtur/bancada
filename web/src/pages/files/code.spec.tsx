import { afterEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { languageOf, useDark } from "@/pages/files/code";

describe("languageOf", () => {
  it("knows the languages this project is written in", () => {
    expect(languageOf("src/db.rs")).toBe("rust");
    expect(languageOf("web/src/app.tsx")).toBe("typescript");
  });

  it("falls back to plain text rather than guessing", () => {
    // A table, not a guess: an extension nobody listed reads as text
    // instead of being coloured as something it is not.
    expect(languageOf("LICENSE")).toBe("plaintext");
    expect(languageOf("data.parquet")).toBe("plaintext");
  });
});

describe("useDark", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("reads the class that is already there", () => {
    document.documentElement.classList.add("dark");
    expect(renderHook(() => useDark()).result.current).toBe(true);
  });

  it("follows a change made by somebody else", async () => {
    // The editor is built once per file. Without this it keeps whichever
    // palette it was born in, and switching theme leaves a dark pane on a
    // light page — which this product has already done once.
    const { result } = renderHook(() => useDark());
    expect(result.current).toBe(false);

    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });
    expect(result.current).toBe(true);
  });
});

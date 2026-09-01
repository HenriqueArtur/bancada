import { afterEach, describe, expect, it, vi } from "vitest";
import { remember as rememberTheme, stored as storedTheme } from "@/core/appearance";
import { remember as rememberLanguage, stored as storedLanguage } from "@/core/language";
import { markSeen, seenOf } from "@/core/review";

/// A window whose storage refuses.
///
/// Private browsing, a cleared origin, a browser told to block site data.
/// Every read and write is wrapped for it, and the claim in those comments —
/// *a window that cannot remember still has to open* — is only a claim until
/// something proves it.
function refuses() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage is disabled");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage is disabled");
  });
}

describe("when the store refuses", () => {
  afterEach(() => vi.restoreAllMocks());

  it("the palette falls back to following the machine", () => {
    refuses();
    expect(storedTheme()).toBe("system");
  });

  it("choosing a palette does not throw", () => {
    refuses();
    expect(() => rememberTheme("dark")).not.toThrow();
  });

  it("the language falls back to having no opinion", () => {
    // `null`, which means follow the machine — not English, which would
    // freeze whatever the first open happened to be.
    refuses();
    expect(storedLanguage()).toBeNull();
  });

  it("choosing a language does not throw", () => {
    refuses();
    expect(() => rememberLanguage("pt-BR")).not.toThrow();
  });

  it("nothing counts as reviewed, which is the safe direction", () => {
    // A file nobody vouched for is unreviewed. Defaulting the other way
    // would hide work behind a storage failure.
    refuses();
    expect(seenOf("bancada")).toEqual({});
    expect(() => markSeen("bancada", "a.rs", "abc")).not.toThrow();
  });
});

describe("when the store holds nonsense", () => {
  it("a corrupted record reads as nothing rather than crashing", () => {
    // It is a string store shared with anything else on the origin.
    localStorage.setItem("bancada.seen", "{not json");
    expect(seenOf("bancada")).toEqual({});
  });

  it("a record of the wrong shape reads as nothing", () => {
    localStorage.setItem("bancada.seen", '"a string"');
    expect(seenOf("bancada")).toEqual({});
  });
});

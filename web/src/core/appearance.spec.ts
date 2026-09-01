import { beforeEach, describe, expect, it } from "vitest";
import { nameOf, remember, resolve, stored, THEMES } from "@/core/appearance";
import { translator } from "@/core/language";

/// English, so every assertion reads as the phrase itself.
const t = translator({});

describe("resolve", () => {
  it("takes the machine's word when told to follow it", () => {
    expect(resolve("system", true)).toBe(true);
    expect(resolve("system", false)).toBe(false);
  });

  it("overrides the machine when a side was picked", () => {
    // The point of the control: reading in a dark room on a machine set to
    // light is a real situation, and so is the reverse.
    expect(resolve("dark", false)).toBe(true);
    expect(resolve("light", true)).toBe(false);
  });
});

describe("what is remembered", () => {
  beforeEach(() => localStorage.clear());

  it("follows the system until somebody says otherwise", () => {
    expect(stored()).toBe("system");
  });

  it("keeps a choice", () => {
    remember("dark");
    expect(stored()).toBe("dark");
  });

  it("falls back rather than trusting whatever is in there", () => {
    // localStorage is a string store shared with anything else on the
    // origin, and a garbage value must not become a garbage class name.
    localStorage.setItem("bancada.theme", "solarized");
    expect(stored()).toBe("system");
  });
});

describe("nameOf", () => {
  it("says what following the system means, rather than naming it", () => {
    // "System" is a label; "Follow the system" is what the option does.
    expect(nameOf("system", t)).toBe("Follow the system");
  });

  it("names every theme, so none can render blank", () => {
    for (const theme of THEMES) expect(nameOf(theme, t).length).toBeGreaterThan(0);
  });
});

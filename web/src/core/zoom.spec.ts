import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  apply,
  clamp,
  CLOSEST,
  FURTHEST,
  percent,
  pressed,
  remember,
  scale,
  stepped,
  stored,
} from "@/core/zoom";

describe("clamp", () => {
  it("holds a level inside the bounds", () => {
    expect(clamp(99)).toBe(FURTHEST);
    expect(clamp(-99)).toBe(CLOSEST);
  });

  it("reads anything unreadable as no zoom at all", () => {
    // `1.2 ** NaN` is `NaN`, and a document scaled by `NaN` disappears.
    expect(clamp(Number.NaN)).toBe(0);
    expect(clamp(Number.POSITIVE_INFINITY)).toBe(FURTHEST);
  });

  it("rounds, because a level is a step and not a dial", () => {
    expect(clamp(1.4)).toBe(1);
  });
});

describe("scale", () => {
  it("is untouched at nothing", () => {
    expect(scale(0)).toBe(1);
  });

  it("grows by the same proportion at every size", () => {
    // A linear scale makes the first press enormous and the tenth
    // invisible. Each step has to feel like the last one.
    expect(scale(1) / scale(0)).toBeCloseTo(scale(5) / scale(4));
  });

  it("goes both ways", () => {
    expect(scale(-1)).toBeLessThan(1);
    expect(scale(1)).toBeGreaterThan(1);
  });

  it("never returns something a document cannot be scaled by", () => {
    expect(scale(Number.NaN)).toBe(1);
  });
});

describe("percent", () => {
  it("is a hundred at rest", () => {
    expect(percent(0)).toBe(100);
  });

  it("is a number somebody would say out loud", () => {
    expect(percent(1)).toBe(120);
    expect(percent(-1)).toBe(83);
  });
});

describe("pressed", () => {
  const key = (k: string, mod: Partial<{ metaKey: boolean; ctrlKey: boolean }> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    ...mod,
  });

  it("answers to the key with the plus printed on it, however it reports", () => {
    // `=` is what the unshifted key sends, and a person pressing it expects
    // the window to grow whichever name their keyboard decides on.
    expect(pressed(key("+", { metaKey: true }))).toBe("in");
    expect(pressed(key("=", { metaKey: true }))).toBe("in");
    expect(pressed(key("-", { ctrlKey: true }))).toBe("out");
    expect(pressed(key("_", { ctrlKey: true }))).toBe("out");
    expect(pressed(key("0", { metaKey: true }))).toBe("reset");
  });

  it("takes control as well as command, so one build serves both machines", () => {
    expect(pressed(key("=", { ctrlKey: true }))).toBe("in");
  });

  it("ignores the same keys without the modifier", () => {
    // Otherwise typing a minus into the filter box shrinks the window.
    expect(pressed(key("-"))).toBeNull();
    expect(pressed(key("0"))).toBeNull();
  });

  it("has nothing to say about any other key", () => {
    expect(pressed(key("k", { metaKey: true }))).toBeNull();
  });
});

describe("stepped", () => {
  it("steps one at a time", () => {
    expect(stepped(0, "in")).toBe(1);
    expect(stepped(0, "out")).toBe(-1);
  });

  it("goes back to nothing rather than to the middle of the range", () => {
    expect(stepped(7, "reset")).toBe(0);
    expect(stepped(-4, "reset")).toBe(0);
  });

  it("stops at the bounds instead of running past them", () => {
    expect(stepped(FURTHEST, "in")).toBe(FURTHEST);
    expect(stepped(CLOSEST, "out")).toBe(CLOSEST);
  });
});

describe("remembering", () => {
  beforeEach(() => localStorage.clear());

  it("is nothing before anybody chose", () => {
    expect(stored()).toBe(0);
  });

  it("comes back at the size it was left", () => {
    remember(3);
    expect(stored()).toBe(3);
  });

  it("comes back inside the bounds even if the stored value is not", () => {
    // Somebody edited local storage, or an older build wrote a wider range.
    localStorage.setItem("bancada.zoom", "999");
    expect(stored()).toBe(FURTHEST);
  });

  it("reads nonsense as no zoom rather than as a broken window", () => {
    localStorage.setItem("bancada.zoom", "enormous");
    expect(stored()).toBe(0);
  });

  it("opens at a hundred when the store refuses to be read", () => {
    // A private window, or a browser told to keep nothing. A window that
    // cannot remember still has to open.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(stored()).toBe(0);
    vi.restoreAllMocks();
  });

  it("carries on when the store refuses to be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => remember(2)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("apply", () => {
  it("scales the document", () => {
    apply(1);
    expect(document.documentElement.style.zoom).toBe(String(scale(1)));
    apply(0);
    expect(document.documentElement.style.zoom).toBe("1");
  });
});

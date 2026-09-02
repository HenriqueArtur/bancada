import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apply,
  NARROWEST,
  nameOf,
  remember,
  rememberSide,
  resolve,
  side,
  stored,
  rememberWidth,
  systemIsDark,
  THEMES,
  width,
  WIDEST,
} from "@/core/appearance";
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

describe("apply and the machine", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("puts the resolved palette on the document, and takes it off", () => {
    // One writer. Everything else reads the class, which is what keeps a
    // light page from ending up with a dark editor.
    apply(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    apply(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("answers what the machine is set to", () => {
    // jsdom's `matchMedia` is the shim in `test-setup`, which says light —
    // the assertion is that the question is asked at all, not the answer.
    expect(typeof systemIsDark()).toBe("boolean");
  });

  it("keeps following the machine when nothing was stored", () => {
    localStorage.clear();
    expect(resolve(stored(), true)).toBe(true);
  });
});

describe("which side the conversation sits on", () => {
  beforeEach(() => localStorage.clear());

  it("is the right by default, where a reading pane usually is", () => {
    expect(side()).toBe("right");
  });

  it("comes back where it was left", () => {
    rememberSide("left");
    expect(side()).toBe("left");
  });

  it("reads anything else as the right rather than as nothing", () => {
    localStorage.setItem("bancada.chat-side", "sideways");
    expect(side()).toBe("right");
  });

  it("opens on the right when the store refuses to be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(side()).toBe("right");
    vi.restoreAllMocks();
  });

  it("carries on when the store refuses to be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => rememberSide("left")).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("how wide the conversation is", () => {
  beforeEach(() => localStorage.clear());

  it("starts at the narrowest it is allowed to be", () => {
    expect(width()).toBe(NARROWEST);
  });

  it("remembers a width you dragged to", () => {
    rememberWidth(480);
    expect(width()).toBe(480);
  });

  it("refuses one wider than the screen it sits beside", () => {
    // Read back on a laptop, a width saved on a 2400px monitor would leave
    // the content column with nothing.
    rememberWidth(4000);
    expect(width()).toBe(WIDEST);
  });

  it("refuses one narrower than the panel can be read at", () => {
    rememberWidth(10);
    expect(width()).toBe(NARROWEST);
  });

  it("falls back to the narrowest when what was stored is not a width", () => {
    localStorage.setItem("bancada.chat-width", "wide please");
    expect(width()).toBe(NARROWEST);
  });

  it("still opens at a readable width when the window cannot remember", () => {
    // Private browsing throws on read. A panel that cannot recall its width
    // still has to have one.
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(width()).toBe(NARROWEST);
    getItem.mockRestore();
  });

  it("survives being unable to save one", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => rememberWidth(500)).not.toThrow();
    setItem.mockRestore();
  });
});

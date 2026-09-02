import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIONS,
  bound,
  clash,
  chord,
  DEFAULTS,
  forget,
  matches,
  rebind,
  spell,
  stored,
  type Action,
} from "@/core/shortcuts";

const key = (
  k: string,
  mod: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mod,
});

describe("chord", () => {
  it("spells a keystroke the same way every time", () => {
    expect(chord(key("k", { metaKey: true }))).toBe("mod+k");
    expect(chord(key("K", { metaKey: true, shiftKey: true }))).toBe("mod+shift+k");
  });

  it("reads command and control as one modifier", () => {
    // One binding serves both machines. A product that made you rebind
    // everything on the other one would be two products.
    expect(chord(key("k", { metaKey: true }))).toBe(chord(key("k", { ctrlKey: true })));
  });

  it("is nothing without a modifier", () => {
    // Otherwise typing into the filter box fires shortcuts.
    expect(chord(key("k"))).toBeNull();
  });

  it("keeps a bare modifier out", () => {
    expect(chord(key("Meta", { metaKey: true }))).toBeNull();
    expect(chord(key("Shift", { shiftKey: true }))).toBeNull();
  });
});

describe("matches", () => {
  it("finds the action a keystroke is bound to", () => {
    expect(matches(DEFAULTS, key("b", { metaKey: true }))).toBe("chat");
  });

  it("finds nothing for a keystroke nobody claimed", () => {
    expect(matches(DEFAULTS, key("j", { metaKey: true }))).toBeNull();
  });
});

describe("clash", () => {
  it("names who already has the key", () => {
    const has = bound(DEFAULTS, "chat");
    expect(clash(DEFAULTS, "zoom.in", has)).toBe("chat");
  });

  it("says nothing when the key is free", () => {
    expect(clash(DEFAULTS, "chat", "mod+j")).toBeNull();
  });

  it("does not call an action a clash with itself", () => {
    expect(clash(DEFAULTS, "chat", bound(DEFAULTS, "chat"))).toBeNull();
  });
});

describe("remembering", () => {
  beforeEach(() => localStorage.clear());

  it("is the defaults before anybody changed one", () => {
    expect(stored()).toEqual(DEFAULTS);
  });

  it("keeps a rebinding across restarts", () => {
    rebind("chat", "mod+shift+c");
    expect(stored().chat).toBe("mod+shift+c");
  });

  it("leaves the others where they were", () => {
    rebind("chat", "mod+shift+c");
    expect(stored()["zoom.in"]).toBe(DEFAULTS["zoom.in"]);
  });

  it("puts one back", () => {
    rebind("chat", "mod+shift+c");
    forget("chat");
    expect(stored().chat).toBe(DEFAULTS.chat);
  });

  it("reads a stored binding for an action that no longer exists as nothing", () => {
    // A build removed the action, and the key it had is not a key any more.
    localStorage.setItem("bancada.shortcuts", JSON.stringify({ "gone.away": "mod+q" }));
    expect(Object.keys(stored())).toEqual(Object.keys(DEFAULTS));
  });

  it("reads nonsense as the defaults rather than as no shortcuts at all", () => {
    localStorage.setItem("bancada.shortcuts", "{not json");
    expect(stored()).toEqual(DEFAULTS);
  });
});

describe("spell", () => {
  it("reads the way the machine writes it", () => {
    expect(spell("mod+shift+b", true)).toBe("⌘⇧B");
    expect(spell("mod+shift+b", false)).toBe("Ctrl+Shift+B");
  });

  it("leaves a named key named", () => {
    expect(spell("mod+enter", true)).toBe("⌘enter");
  });

  it("keeps a modifier it has no symbol for", () => {
    expect(spell("mod+hyper+k", true)).toBe("⌘hyperK");
  });
});

describe("ACTIONS", () => {
  it("gives every action a default", () => {
    for (const a of ACTIONS) expect(DEFAULTS[a as Action]).toBeTruthy();
  });

  it("hands out no key twice", () => {
    const keys = Object.values(DEFAULTS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("a window that cannot remember", () => {
  it("still rebinds, rather than throwing at whoever pressed the key", () => {
    // Private browsing and a full quota both throw on write. A shortcut that
    // could not be saved is still a shortcut for this session.
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(rebind("chat", "mod+j").chat).toBe("mod+j");
    setItem.mockRestore();
  });
});

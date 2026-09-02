import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { DEFAULTS } from "@/core/shortcuts";
import { useKeys } from "@/lib/keys";

const press = (key: string, mods: Partial<KeyboardEventInit> = {}) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ...mods, cancelable: true }));

describe("useKeys", () => {
  it("runs the action the keystroke is bound to", () => {
    const chat = vi.fn();
    renderHook(() => useKeys(DEFAULTS, { chat }));
    press("b", { metaKey: true });
    expect(chat).toHaveBeenCalledOnce();
  });

  it("leaves an unbound keystroke to whoever else wants it", () => {
    const chat = vi.fn();
    renderHook(() => useKeys(DEFAULTS, { chat }));
    const e = new KeyboardEvent("keydown", { key: "b", cancelable: true });
    window.dispatchEvent(e);
    expect(chat).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("does not swallow a key nobody in the table answers to", () => {
    // Bound in the registry, but this screen offers no such action — the
    // browser's own binding is then better than nothing happening at all.
    renderHook(() => useKeys(DEFAULTS, {}));
    const e = new KeyboardEvent("keydown", { key: "b", metaKey: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it("runs the handler from the latest render, not the one it was hung with", () => {
    // Handlers close over state. Hung once and never refreshed, every key
    // would act on whatever the window looked like when it opened.
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ chat }) => useKeys(DEFAULTS, { chat }), {
      initialProps: { chat: first },
    });
    rerender({ chat: second });
    press("b", { metaKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("stops listening once the window is gone", () => {
    const chat = vi.fn();
    const { unmount } = renderHook(() => useKeys(DEFAULTS, { chat }));
    unmount();
    press("b", { metaKey: true });
    expect(chat).not.toHaveBeenCalled();
  });
});

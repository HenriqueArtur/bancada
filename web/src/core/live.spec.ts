import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: (...a: unknown[]) => listen(...a) }));

const { FALLBACK_MS, live, watching } = await import("@/core/live");

/// Let every pending promise settle. `live` reports its mode through one.
const settle = () => new Promise((r) => setTimeout(r, 0));

// The two mocks are module-level and would otherwise carry a call from the
// test before into the assertions of the next.
beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
});

describe("watching", () => {
  it("asks the core whether it is watching", async () => {
    invoke.mockResolvedValueOnce(true);
    await expect(watching()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("watching");
  });
});

describe("live", () => {
  it("listens when the core is watching, and does not poll", async () => {
    vi.useFakeTimers();
    const then = vi.fn();
    invoke.mockResolvedValueOnce(true);
    listen.mockResolvedValueOnce(() => {});

    const it_ = live(then);
    await expect(it_.asking).resolves.toBe(true);
    expect(listen).toHaveBeenCalledWith("bancada:changed", expect.any(Function));

    vi.advanceTimersByTime(FALLBACK_MS * 3);
    expect(then).not.toHaveBeenCalled();
    it_.stop();
    vi.useRealTimers();
  });

  it("runs the callback when the core says something changed", async () => {
    const then = vi.fn();
    invoke.mockResolvedValueOnce(true);
    listen.mockImplementationOnce((_name: string, cb: () => void) => {
      cb();
      return Promise.resolve(() => {});
    });

    const it_ = live(then);
    await it_.asking;
    expect(then).toHaveBeenCalled();
    it_.stop();
  });

  it("goes back to asking on a timer when the core is not watching", async () => {
    vi.useFakeTimers();
    const then = vi.fn();
    invoke.mockResolvedValueOnce(false);

    const it_ = live(then);
    await expect(it_.asking).resolves.toBe(false);
    expect(listen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(FALLBACK_MS);
    expect(then).toHaveBeenCalledTimes(1);
    it_.stop();
    vi.useRealTimers();
  });

  it("asks on a timer when there is no core to ask at all", async () => {
    // A plain browser: the probe page runs these components outside Tauri,
    // and a screen that threw there would be a screen nobody could look at.
    vi.useFakeTimers();
    const then = vi.fn();
    invoke.mockRejectedValueOnce(new Error("not a tauri window"));

    const it_ = live(then);
    await expect(it_.asking).resolves.toBe(false);
    vi.advanceTimersByTime(FALLBACK_MS);
    expect(then).toHaveBeenCalledTimes(1);
    it_.stop();
    vi.useRealTimers();
  });

  it("stops the timer when it is stopped", async () => {
    vi.useFakeTimers();
    const then = vi.fn();
    invoke.mockResolvedValueOnce(false);

    const it_ = live(then);
    await it_.asking;
    it_.stop();
    vi.advanceTimersByTime(FALLBACK_MS * 3);
    expect(then).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("attaches nothing when it was stopped before the core answered", async () => {
    // The screen went away while the question was in flight. A listener
    // attached to a component that is gone is a leak that fires forever.
    const drop = vi.fn();
    invoke.mockResolvedValueOnce(true);
    listen.mockResolvedValueOnce(drop);

    const it_ = live(vi.fn());
    it_.stop();
    await it_.asking;
    await settle();
    expect(drop).toHaveBeenCalled();
  });
});

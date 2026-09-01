import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Queue } from "@/core/queue";

const invoke = vi.fn();
const raise = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@/core/attention", async () => {
  const real = await vi.importActual<typeof import("@/core/attention")>("@/core/attention");
  return { ...real, raise: (...a: unknown[]) => raise(...a) };
});

const { useCockpit } = await import("@/pages/cockpit/logic");

const queue = (over: Partial<Queue> = {}): Queue => ({
  groups: [],
  wip: { sessions_waiting: 0, items: 0, limit: 4 },
  watching: 1,
  unreachable: [],
  elsewhere: null,
  ...over,
});

const waiting = (n: number) =>
  queue({
    wip: { sessions_waiting: n, items: n, limit: 4 },
    groups: Array.from({ length: n }, (_, i) => ({
      session: `s${i}`,
      items: [
        {
          item: {
            session: `s${i}`,
            kind: "Question" as const,
            raised_at: i,
            blocking: 0,
            project_weight: 1,
            project: "p",
          },
          score: 1,
          age_ms: 0,
          kind_factor: 1,
          weighted_age_ms: 0,
          blocking_factor: 1,
        },
      ],
    })),
  });

describe("useCockpit", () => {
  beforeEach(() => {
    invoke.mockReset();
    raise.mockReset().mockResolvedValue(undefined);
  });

  it("reads the queue as soon as it is mounted", async () => {
    invoke.mockResolvedValue(queue());
    const { result } = renderHook(() => useCockpit());
    await waitFor(() => expect(result.current.queue).not.toBeNull());
    expect(invoke).toHaveBeenCalledWith("queue");
  });

  it("announces nothing on the first reading", async () => {
    // Everything is new when you have never looked, and a notification for a
    // queue you just opened trains you to dismiss the one that matters.
    invoke.mockResolvedValue(waiting(1));
    renderHook(() => useCockpit());
    await waitFor(() => expect(raise).toHaveBeenCalled());
    expect(raise).toHaveBeenCalledWith(1, null);
  });

  it("names the failure rather than showing a blank screen", async () => {
    invoke.mockRejectedValue(new Error("core is gone"));
    const { result } = renderHook(() => useCockpit());
    await waitFor(() => expect(result.current.failed).toMatch(/core is gone/));
    expect(result.current.queue).toBeNull();
  });

  it("says when it cannot reach you, without losing the queue", async () => {
    // A supervisor that silently stopped supervising is worse than one that
    // says it cannot — silence looks exactly like a quiet queue.
    invoke.mockResolvedValue(queue());
    raise.mockRejectedValue(new Error("notification: refused"));
    const { result } = renderHook(() => useCockpit());
    await waitFor(() => expect(result.current.mute).toMatch(/refused/));
    expect(result.current.queue).not.toBeNull();
  });
});

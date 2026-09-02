import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

const { loadSessions } = await import("@/core/sessions");

describe("the sessions seam", () => {
  it("asks for one project's sessions by name", () => {
    // A renamed Rust command fails at runtime and nowhere else: `invoke`
    // takes a string, and no type spans the seam to catch it.
    loadSessions("bancada");
    expect(invoke).toHaveBeenCalledWith("sessions", { project: "bancada" });
  });
});

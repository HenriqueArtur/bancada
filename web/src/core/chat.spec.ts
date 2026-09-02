import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

const { loadChat } = await import("@/core/chat");

describe("the chat seam", () => {
  it("asks for one session's conversation, from the end", () => {
    // A renamed Rust command fails at runtime and nowhere else: `invoke`
    // takes a string, and no type spans the seam to catch it.
    loadChat("bancada", "10414dd9", 0);
    expect(invoke).toHaveBeenCalledWith("chat", {
      project: "bancada",
      session: "10414dd9",
      skip: 0,
    });
  });

  it("carries how far back the reader has already walked", () => {
    // `skip` counts messages already on screen, not pages: the panel asks
    // with `said.length`, and a page size agreed twice would drift.
    loadChat("bancada", "10414dd9", 40);
    expect(invoke).toHaveBeenLastCalledWith("chat", {
      project: "bancada",
      session: "10414dd9",
      skip: 40,
    });
  });
});

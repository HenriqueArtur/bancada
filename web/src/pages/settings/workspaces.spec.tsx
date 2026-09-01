import { describe, expect, it } from "vitest";
import { whyNot } from "@/pages/settings/workspaces";
import type { Config } from "@/core/settings";

const config: Config = {
  workspaces: [{ id: "personal" }],
  runtimes: [],
  projects: [],
};

describe("whyNot", () => {
  it("lets a new name through", () => {
    expect(whyNot("client-x", config)).toBeNull();
  });

  it("asks for a name before anything else", () => {
    expect(whyNot("   ", config)).toBe("give it a name");
  });

  it("refuses one that already exists", () => {
    // Registering it again would replace the existing one and silently take
    // its export level with it.
    expect(whyNot("personal", config)).toBe("personal already exists");
  });

  it("ignores the spaces around a name", () => {
    expect(whyNot("  personal  ", config)).toBe("personal already exists");
  });

  it("lets a workspace keep its own name while being edited", () => {
    // A thing is not a collision with itself.
    expect(whyNot("personal", config, "personal")).toBeNull();
  });

  it("still refuses renaming onto a name somebody else has", () => {
    const two = { ...config, workspaces: [{ id: "personal" }, { id: "client-x" }] };
    expect(whyNot("client-x", two, "personal")).toBe("client-x already exists");
  });
});

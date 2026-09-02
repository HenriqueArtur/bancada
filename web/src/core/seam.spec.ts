import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

const review = await import("@/core/review");
const settings = await import("@/core/settings");
const work = await import("@/core/work");
const sessions = await import("@/core/sessions");
const chat = await import("@/core/chat");
const attention = await import("@/core/attention");

/// Every call the webview can make into the core, and what it must be named.
///
/// A renamed Rust command fails at runtime with "command not found" and
/// nothing catches it — `invoke` takes a string. Naming each one here turns
/// that into a failing test, which is the only thing on this side of the
/// seam that can.
describe("the seam", () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue(undefined));

  const calls: [string, () => unknown, string, Record<string, unknown>][] = [
    ["queue", () => review.loadReview("p"), "review", { project: "p", seen: {} }],
    ["tree", () => review.loadTree("p"), "tree", { project: "p", sub: null }],
    [
      "tree with a path",
      () => review.loadTree("p", "src"),
      "tree",
      { project: "p", sub: "src" },
    ],
    ["file", () => review.loadFile("p", "a.rs"), "file", { project: "p", path: "a.rs" }],
    ["worktree", () => review.loadWorktree("p"), "worktree", { project: "p" }],
    ["how much moved", () => review.loadSummary("p"), "summary", { project: "p" }],
    ["paths", () => review.loadPaths("p"), "paths", { project: "p" }],
    ["settings", () => settings.loadSettings(), "settings", {}],
    ["discover", () => settings.discover(), "discover", {}],
    [
      "preview",
      () => settings.previewProject("/x", "r"),
      "preview",
      { path: "/x", runtime: "r" },
    ],
    ["forget a project", () => settings.forgetProject("p"), "forget_project", { id: "p" }],
    ["sessions", () => sessions.loadSessions("p"), "sessions", { project: "p" }],
    [
      "one session's conversation",
      () => chat.loadChat("p", "s", 20),
      "chat",
      { project: "p", session: "s", skip: 20 },
    ],
    ["work", () => work.loadWork(), "work", {}],
    ["forget a workspace", () => work.forgetWorkspace("w"), "forget_workspace", { id: "w" }],
  ];

  for (const [what, call, command, args] of calls) {
    it(`asks the core to ${what}`, async () => {
      await call();
      // A command with no arguments is invoked with the name alone.
      if (Object.keys(args).length === 0) expect(invoke).toHaveBeenCalledWith(command);
      else expect(invoke).toHaveBeenCalledWith(command, args);
    });
  }

  it("registers a project, saying what it was called before", () => {
    const project = {
      id: "a",
      workspace: "w",
      runtime: "r",
      path: "/x",
      weight: 1,
      idleAfterMinutes: 2,
    };
    void settings.registerProject(project, "was");
    expect(invoke).toHaveBeenCalledWith("register_project", { project, previous: "was" });
  });

  it("registers a new project with no previous name", () => {
    // `null`, not absent: the Rust side takes an `Option<String>`, and an
    // absent key would deserialise as a missing argument rather than `None`.
    const project = {
      id: "a",
      workspace: "w",
      runtime: "r",
      path: "/x",
      weight: 1,
      idleAfterMinutes: 2,
    };
    void settings.registerProject(project);
    expect(invoke).toHaveBeenCalledWith("register_project", { project, previous: null });
  });

  it("registers a runtime", () => {
    const runtime = {
      id: "box",
      kind: "vm",
      prefix: ["echo"],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/s",
      sharedFs: true,
      harness: null,
      model: null,
    };
    void settings.registerRuntime(runtime);
    expect(invoke).toHaveBeenCalledWith("register_runtime", { runtime });
  });

  it("registers a workspace, saying what it was called before", () => {
    void work.registerWorkspace({ id: "mine" }, "personal");
    expect(invoke).toHaveBeenCalledWith("register_workspace", {
      workspace: { id: "mine" },
      previous: "personal",
    });
  });

  it("raises attention with the count and what to announce", () => {
    const announce = { title: "t", body: "b" };
    void attention.raise(2, announce);
    expect(invoke).toHaveBeenCalledWith("attention", { waiting: 2, announce });
  });

  it("carries what has already been reviewed into the review", () => {
    localStorage.clear();
    review.markSeen("p", "src/db.rs", "abc");
    void review.loadReview("p");
    expect(invoke).toHaveBeenCalledWith("review", {
      project: "p",
      seen: { "src/db.rs": "abc" },
    });
  });
});

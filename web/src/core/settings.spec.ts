import { describe, expect, it } from "vitest";
import {
  BLANK,
  BLANK_RUNTIME,
  THIS_MACHINE,
  evidenceOf,
  logDirName,
  nameFrom,
  whyNot,
  whyNotRuntime,
  type Config,
  type Project,
} from "@/core/settings";

const config: Config = {
  workspaces: [{ id: "personal" }],
  runtimes: [
    {
      id: THIS_MACHINE,
      kind: "local",
      prefix: [],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/Users/h/.claude",
      sharedFs: true,
    },
    {
      id: "devbox",
      kind: "vm",
      prefix: ["limactl", "shell", "devbox", "--"],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/state/claude",
      sharedFs: true,
    },
  ],
  projects: [],
};

const good: Project = {
  ...BLANK,
  id: "neo-gitmoji",
  path: "/mnt/dev/neo-gitmoji.nvim",
  runtime: "devbox",
  workspace: "personal",
};

describe("whyNot", () => {
  it("lets a complete registration through", () => {
    expect(whyNot(good, config)).toBeNull();
  });

  it("asks for one thing at a time, in the order the form is filled", () => {
    // Everything is missing here; the first answer must be the first field.
    expect(whyNot(BLANK, config)).toBe("give it a name");
  });

  it("insists the path is the guest's absolute spelling", () => {
    expect(whyNot({ ...good, path: "dev/thing" }, config)).toMatch(/absolute/);
  });

  it("refuses a runtime nobody registered", () => {
    expect(whyNot({ ...good, runtime: "sunne" }, config)).toBe(
      "no runtime registered as sunne",
    );
  });

  it("refuses a workspace nobody registered", () => {
    expect(whyNot({ ...good, workspace: "client-x" }, config)).toBe(
      "no workspace registered as client-x",
    );
  });

  it("refuses weight zero, which would erase the project from the order", () => {
    expect(whyNot({ ...good, weight: 0 }, config)).toMatch(/erase/);
  });
});

describe("logDirName", () => {
  it("turns both separators into a dash, the way the harness does", () => {
    expect(logDirName("/mnt/dev/neo-gitmoji.nvim")).toBe("-mnt-dev-neo-gitmoji-nvim");
  });

  it("is lossy, and that is why it is shown before saving", () => {
    // `a.b` and `a-b` land on the same directory. Nothing can recover the
    // original from the name, so the registration has to be checked by
    // eye against what the harness actually wrote.
    expect(logDirName("/x/a.b")).toBe(logDirName("/x/a-b"));
  });
});

describe("the machine bancada runs on", () => {
  it("is what a blank registration already points at", () => {
    // The product is executing there, so offering it is never wrong — and
    // it is the right answer most of the time.
    expect(BLANK.runtime).toBe(THIS_MACHINE);
  });

  it("still needs the rest of the form", () => {
    // Preselecting a runtime must not make an empty form look complete.
    expect(whyNot(BLANK, config)).toBe("give it a name");
  });
});

describe("nameFrom", () => {
  it("takes the folder's own name", () => {
    expect(nameFrom("/Users/h/dev/neo-gitmoji.nvim")).toBe("neo-gitmoji.nvim");
  });

  it("survives a trailing slash, which every folder picker adds sometimes", () => {
    expect(nameFrom("/Users/h/dev/thing/")).toBe("thing");
  });
});

describe("evidenceOf", () => {
  const p = (over = {}) => ({
    sessions: 0,
    reachable: true,
    versioned: true,
    logDir: "/x",
    why: null,
    ...over,
  });

  it("says nothing before there is anything to say", () => {
    expect(evidenceOf(null)).toBeNull();
  });

  it("counts what is already there", () => {
    expect(evidenceOf(p({ sessions: 4 }))!.says).toBe("4 sessions already recorded here");
  });

  it("says one session in the singular, because it will happen constantly", () => {
    expect(evidenceOf(p({ sessions: 1 }))!.says).toBe("1 session already recorded here");
  });

  it("distinguishes an empty folder from an unreachable one", () => {
    // These look identical without saying so, and one of them is a typo.
    expect(evidenceOf(p())!.tone).toBe("empty");
    expect(evidenceOf(p({ reachable: false, why: "no such directory" }))!.tone).toBe("missing");
  });

  it("passes on the runtime's own words for why it failed", () => {
    expect(evidenceOf(p({ reachable: false, why: "permission denied" }))!.says).toBe(
      "permission denied",
    );
  });
});

describe("whyNotRuntime", () => {
  const vm = { ...BLANK_RUNTIME, id: "sunne", configDir: "/state/claude", prefix: ["limactl"] };

  it("lets a complete one through", () => {
    expect(whyNotRuntime(vm, config)).toBeNull();
  });

  it("refuses the name reserved for the machine bancada runs on", () => {
    expect(whyNotRuntime({ ...vm, id: THIS_MACHINE }, config)).toMatch(/belongs to the machine/);
  });

  it("refuses a name already taken", () => {
    expect(whyNotRuntime({ ...vm, id: "devbox" }, config)).toBe("devbox is already registered");
  });

  it("insists on a prefix, since without one it is this machine twice", () => {
    expect(whyNotRuntime({ ...vm, prefix: [] }, config)).toMatch(/in front of every command/);
  });
});

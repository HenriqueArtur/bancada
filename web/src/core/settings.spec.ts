import { describe, expect, it } from "vitest";
import {
  BLANK,
  BLANK_RUNTIME,
  THIS_MACHINE,
  evidenceOf,
  logDirName,
  nameFrom,
  presetLabel,
  whereFrom,
  whyNot,
  whyNotRuntime,
  type Config,
  type Project,
} from "@/core/settings";
import { translator } from "@/core/language";

/// English, so every assertion reads as the phrase itself.
const t = translator({});

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
      harness: null,
      model: null,
    },
    {
      id: "devbox",
      kind: "vm",
      prefix: ["limactl", "shell", "devbox", "--"],
      hostRoot: "/",
      guestRoot: "/",
      configDir: "/state/claude",
      sharedFs: true,
      harness: null,
      model: null,
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
    expect(whyNot(good, config, t)).toBeNull();
  });

  it("asks for one thing at a time, in the order the form is filled", () => {
    // Everything is missing here; the first answer must be the first field.
    expect(whyNot(BLANK, config, t)).toBe("give it a name");
  });

  it("insists the path is the guest's absolute spelling", () => {
    expect(whyNot({ ...good, path: "dev/thing" }, config, t)).toMatch(/absolute/);
  });

  it("refuses a runtime nobody registered", () => {
    expect(whyNot({ ...good, runtime: "sunne" }, config, t)).toBe(
      "no runtime registered as sunne",
    );
  });

  it("refuses a path the machine running it could never see", () => {
    // The two spellings look alike, and the form is filled top to bottom —
    // the path is often typed while the machine is still the default. Caught
    // here because the failure is otherwise silent: the product looks for
    // logs in a directory computed from the wrong path and finds none.
    const mounted: Config = {
      ...config,
      runtimes: config.runtimes.map((r) =>
        r.id === "devbox" ? { ...r, guestRoot: "/mnt/dev" } : r,
      ),
    };
    const project = { ...good, runtime: "devbox", path: "/Users/h/dev/thing" };
    expect(whyNot(project, mounted, t)).toBe(
      "devbox spells its shared folder /mnt/dev, and this is not under it",
    );
    expect(whyNot({ ...project, path: "/mnt/dev/thing" }, mounted, t)).toBeNull();
  });

  it("does not read a directory whose name merely starts the same", () => {
    // `/mnt/development` starts with the letters of `/mnt/dev` and is
    // somewhere else entirely.
    const mounted: Config = {
      ...config,
      runtimes: config.runtimes.map((r) =>
        r.id === "devbox" ? { ...r, guestRoot: "/mnt/dev" } : r,
      ),
    };
    const project = { ...good, runtime: "devbox", path: "/mnt/development/thing" };
    expect(whyNot(project, mounted, t)).toMatch(/not under it/);
    expect(whyNot({ ...project, path: "/mnt/dev" }, mounted, t)).toBeNull();
  });

  it("asks nothing about the path when a machine maps the whole tree", () => {
    // `guestRoot` of `/` is the identity, which every path is under. A check
    // there would refuse nothing and cost a reading.
    expect(whyNot({ ...good, runtime: "devbox", path: "/anywhere" }, config, t)).toBeNull();
  });

  it("refuses a workspace nobody registered", () => {
    expect(whyNot({ ...good, workspace: "client-x" }, config, t)).toBe(
      "no workspace registered as client-x",
    );
  });

  it("refuses weight zero, which would erase the project from the order", () => {
    expect(whyNot({ ...good, limits: { weight: 0 } }, config, t)).toMatch(/erase/);
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
    expect(whyNot(BLANK, config, t)).toBe("give it a name");
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
    expect(evidenceOf(null, t)).toBeNull();
  });

  it("counts what is already there", () => {
    expect(evidenceOf(p({ sessions: 4 }), t)!.says).toBe("4 sessions already recorded here");
  });

  it("says one session in the singular, because it will happen constantly", () => {
    expect(evidenceOf(p({ sessions: 1 }), t)!.says).toBe("1 session already recorded here");
  });

  it("distinguishes an empty folder from an unreachable one", () => {
    // These look identical without saying so, and one of them is a typo.
    expect(evidenceOf(p(), t)!.tone).toBe("empty");
    expect(evidenceOf(p({ reachable: false, why: "no such directory" }), t)!.tone).toBe(
      "missing",
    );
  });

  it("passes on the runtime's own words for why it failed", () => {
    expect(evidenceOf(p({ reachable: false, why: "permission denied" }), t)!.says).toBe(
      "permission denied",
    );
  });
});

describe("whyNotRuntime", () => {
  const vm = { ...BLANK_RUNTIME, id: "sunne", configDir: "/state/claude", prefix: ["limactl"] };

  it("lets a complete one through", () => {
    expect(whyNotRuntime(vm, config, t)).toBeNull();
  });

  it("refuses the name reserved for the machine bancada runs on", () => {
    expect(whyNotRuntime({ ...vm, id: THIS_MACHINE }, config, t)).toMatch(
      /belongs to the machine/,
    );
  });

  it("refuses a name already taken", () => {
    expect(whyNotRuntime({ ...vm, id: "devbox" }, config, t)).toBe(
      "devbox is already registered",
    );
  });

  it("insists on a prefix, since without one it is this machine twice", () => {
    expect(whyNotRuntime({ ...vm, prefix: [] }, config, t)).toMatch(
      /in front of every command/,
    );
  });
});

describe("whyNot, editing rather than creating", () => {
  const taken: Config = {
    ...config,
    projects: [
      { ...good, id: "bancada" },
      { ...good, id: "neo-gitmoji" },
    ],
  };

  it("refuses a name another project already has", () => {
    // Registering over it would replace that project and quietly take its
    // path, weight and workspace with it.
    expect(whyNot({ ...good, id: "neo-gitmoji" }, taken, t)).toBe(
      "neo-gitmoji is already registered",
    );
  });

  it("lets a project keep its own name while being edited", () => {
    // A thing is not a collision with itself, and the form that edits is
    // the same form that creates.
    expect(whyNot({ ...good, id: "bancada" }, taken, t, "bancada")).toBeNull();
  });

  it("still refuses renaming onto a name somebody else has", () => {
    expect(whyNot({ ...good, id: "neo-gitmoji" }, taken, t, "bancada")).toBe(
      "neo-gitmoji is already registered",
    );
  });
});

describe("presetLabel", () => {
  it("names every preset, so none can render blank", () => {
    for (const k of ["normal", "longRefactor", "exploratory"] as const) {
      expect(presetLabel(k, t).length).toBeGreaterThan(0);
    }
  });
});

describe("whereFrom", () => {
  it("says nothing when the project stated the number itself", () => {
    // A note under every line is a note nobody reads. The interesting case
    // is the number that came from somewhere else.
    expect(whereFrom("project", "Personal", t)).toBeNull();
    expect(whereFrom("projectPreset", "Personal", t)).toBeNull();
  });

  it("names the workspace an inherited number came from", () => {
    expect(whereFrom("workspace", "Personal", t)).toBe("from the workspace Personal");
    expect(whereFrom("workspacePreset", "Personal", t)).toBe("from the preset on Personal");
  });

  it("says only `default` for the state almost every project is in", () => {
    // Rendered as a sentence it appeared twice on every card and read as a
    // finding. The baseline is not news, and it must not be the loudest
    // note on the screen.
    expect(whereFrom("baseline", "Personal", t)).toBe("default");
  });
});

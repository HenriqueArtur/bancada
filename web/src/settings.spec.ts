import { describe, expect, it } from "vitest";
import {
  BLANK,
  THIS_MACHINE,
  logDirName,
  whyNot,
  type Config,
  type Project,
} from "./settings";

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

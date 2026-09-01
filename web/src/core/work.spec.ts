import { describe, expect, it } from "vitest";
import { aliveness, exportsAs, since, type Standing } from "@/core/work";
import { translator } from "@/core/language";

/// English, so every assertion reads as the phrase itself.
const t = translator({});

const NOW = 1_700_000_000_000;
const ago = (min: number) => NOW - min * 60_000;

const standing = (over: Partial<Standing> = {}): Standing => ({
  project: {
    id: "bancada",
    workspace: "personal",
    runtime: "this-machine",
    path: "/dev/bancada",
    weight: 1,
    idleAfterMinutes: 2,
  },
  sessions: 0,
  lastActivity: null,
  unreachable: null,
  ...over,
});

describe("exportsAs", () => {
  it("says that the default level is the closed one", () => {
    // `metadata` is where a workspace is born and it is the sealed one,
    // which the word does not say on its own.
    expect(exportsAs({ id: "personal" }, t)).toMatch(/sealed/i);
    expect(exportsAs({ id: "personal", export: "metadata" }, t)).toMatch(/sealed/i);
  });

  it("distinguishes the levels that let something out", () => {
    expect(exportsAs({ id: "x", export: "summary" }, t)).toBe("Exports summaries");
    expect(exportsAs({ id: "x", export: "full" }, t)).toBe("Exports everything");
  });
});

describe("since", () => {
  it("says nothing about a thing that never happened", () => {
    expect(since(null, NOW, t)).toBeNull();
  });

  it("reads the way a person says it", () => {
    expect(since(ago(0.4), NOW, t)).toBe("just now");
    expect(since(ago(11), NOW, t)).toBe("11 min ago");
    expect(since(ago(200), NOW, t)).toBe("3h ago");
    expect(since(ago(60 * 24), NOW, t)).toBe("yesterday");
    expect(since(ago(60 * 24 * 5), NOW, t)).toBe("5 days ago");
  });
});

describe("aliveness", () => {
  it("distinguishes a quiet project from an unreadable one", () => {
    // These look identical from the queue, and one of them is broken. That
    // is the whole reason this screen exists.
    expect(aliveness(standing(), NOW, t)).toBe("Nothing recorded yet");
    expect(aliveness(standing({ unreachable: "no such directory" }), NOW, t)).toBe(
      "no such directory",
    );
  });

  it("counts the sessions and dates the last of them", () => {
    expect(aliveness(standing({ sessions: 7, lastActivity: ago(4) }), NOW, t)).toBe(
      "7 sessions · last 4 min ago",
    );
  });

  it("says the singular, because one session will happen constantly", () => {
    expect(aliveness(standing({ sessions: 1, lastActivity: ago(1) }), NOW, t)).toBe(
      "1 session · last 1 min ago",
    );
  });

  it("still counts when the runtime cannot date the files", () => {
    // A piped runtime answers no timestamps, and a count with no date is
    // better than nothing at all.
    expect(aliveness(standing({ sessions: 3 }), NOW, t)).toBe("3 sessions");
  });
});

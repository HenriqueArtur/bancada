import { describe, expect, it } from "vitest";
import { ago, byDay } from "@/pages/git/logic";

const NOW = 1_756_742_400_000;
const secondsAgo = (n: number) => NOW / 1000 - n;

describe("ago", () => {
  it("is the coarsest unit that is still true", () => {
    expect(ago(secondsAgo(400 * 86_400), NOW)).toEqual({ n: 1, unit: "year" });
    expect(ago(secondsAgo(45 * 86_400), NOW)).toEqual({ n: 1, unit: "month" });
    expect(ago(secondsAgo(3 * 86_400), NOW)).toEqual({ n: 3, unit: "day" });
    expect(ago(secondsAgo(7_200), NOW)).toEqual({ n: 2, unit: "hour" });
    expect(ago(secondsAgo(180), NOW)).toEqual({ n: 3, unit: "minute" });
    expect(ago(secondsAgo(9), NOW)).toEqual({ n: 9, unit: "second" });
  });

  it("rounds down, so it never claims more time than has passed", () => {
    // "2 days ago" for something 47 hours old is the honest direction to be
    // wrong in: a commit is never younger than the reader is told.
    expect(ago(secondsAgo(47 * 3_600), NOW)).toEqual({ n: 1, unit: "day" });
  });

  it("reads a commit from the future as just now", () => {
    // Clock skew between a VM and the host, which is a normal thing for the
    // runtimes this product reads. "In -3 seconds" is not a reading.
    expect(ago(secondsAgo(-500), NOW)).toEqual({ n: 0, unit: "second" });
  });

  it("takes the clock as an argument, so two runs agree", () => {
    const when = secondsAgo(3 * 86_400);
    expect(ago(when, NOW)).toEqual(ago(when, NOW));
  });
});

describe("byDay", () => {
  const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
  const commit = (iso: string, subject: string) => ({
    sha: subject,
    short: subject.slice(0, 4),
    author: "T",
    when: at(iso),
    subject,
  });

  it("gathers the commits of one day under it", () => {
    const got = byDay([
      commit("2026-09-01T18:00:00", "c"),
      commit("2026-09-01T09:00:00", "b"),
      commit("2026-08-31T23:00:00", "a"),
    ]);
    expect(got.map((d) => d.key)).toEqual(["2026-09-01", "2026-08-31"]);
    expect(got[0].commits.map((c) => c.subject)).toEqual(["c", "b"]);
  });

  it("uses the reader's own day, not UTC's", () => {
    // A commit made late at night belongs to the day the person who made it
    // was living in, not to tomorrow.
    const late = new Date(2026, 8, 1, 23, 30);
    const got = byDay([
      {
        sha: "x",
        short: "x",
        author: "T",
        when: Math.floor(late.getTime() / 1000),
        subject: "x",
      },
    ]);
    expect(got[0].key).toBe("2026-09-01");
  });

  it("keeps the order git gave, rather than sorting again", () => {
    // Re-sorting would quietly disagree with whatever ordering the command
    // was asked for.
    const got = byDay([
      commit("2026-08-31T09:00:00", "old"),
      commit("2026-09-01T09:00:00", "new"),
    ]);
    expect(got.map((d) => d.key)).toEqual(["2026-08-31", "2026-09-01"]);
  });

  it("splits a run that returns to a day it already left", () => {
    const got = byDay([
      commit("2026-09-01T09:00:00", "a"),
      commit("2026-08-31T09:00:00", "b"),
      commit("2026-09-01T08:00:00", "c"),
    ]);
    expect(got).toHaveLength(3);
  });

  it("has no days for no commits", () => {
    expect(byDay([])).toEqual([]);
  });
});

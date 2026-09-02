import { useCallback, useEffect, useState } from "react";
import { A_PAGE, type Branch, type Commit, loadBranches, loadHistory } from "@/core/git";

export interface History {
  commits: Commit[];
  branches: Branch[];
  failed: string | null;
  /// Whether asking for another page would bring anything.
  more: boolean;
  loading: boolean;
  further: () => void;
}

export function useHistory(project: string): History {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const page = useCallback(
    (skip: number) => {
      setLoading(true);
      loadHistory(project, skip)
        .then((got) => {
          // The command fetches one more than a page so this can tell "that
          // is all of them" from "there is another page" without counting
          // the whole history. The extra is dropped here rather than shown.
          setMore(got.length > A_PAGE);
          setCommits((have) => [...have, ...got.slice(0, A_PAGE)]);
        })
        .catch((e) => setFailed(String(e)))
        .finally(() => setLoading(false));
    },
    [project],
  );

  useEffect(() => {
    setCommits([]);
    setFailed(null);
    page(0);
    loadBranches(project)
      .then(setBranches)
      // A repository with no branches at all is one with no commits yet, and
      // that is a state, not a failure. Only the history says so out loud.
      .catch(() => setBranches([]));
  }, [project, page]);

  return {
    commits,
    branches,
    failed,
    more,
    loading,
    further: () => page(commits.length),
  };
}

export interface Day {
  /// `2026-09-01`, in the reader's own timezone.
  ///
  /// Built from the local date parts rather than from `toISOString`, which
  /// is UTC: a commit made at eleven at night in São Paulo belongs to the
  /// day the person who made it was living in, not to tomorrow.
  key: string;
  /// The midpoint of the day, for whatever the view wants to format. A
  /// timestamp rather than a formatted string, because how a date reads is
  /// the reader's locale and nothing here can know it.
  at: number;
  commits: Commit[];
}

/// The history split into the days it happened on, newest first.
///
/// The way GitHub does it, and for the reason it does: a flat list of forty
/// commits gives no sense of pace, and "eleven of these landed yesterday" is
/// most of what a supervisor wants from a history.
///
/// Order is preserved rather than sorted. `git log` already returns newest
/// first, and re-sorting here would quietly disagree with `--date-order` or
/// any other ordering the command was given.
export function byDay(commits: Commit[]): Day[] {
  const out: Day[] = [];
  for (const c of commits) {
    const when = new Date(c.when * 1000);
    const key = [
      when.getFullYear(),
      String(when.getMonth() + 1).padStart(2, "0"),
      String(when.getDate()).padStart(2, "0"),
    ].join("-");
    const last = out[out.length - 1];
    if (last?.key === key) last.commits.push(c);
    else out.push({ key, at: when.getTime(), commits: [c] });
  }
  return out;
}

/// How long ago, in the coarsest unit that is still true.
///
/// Coarse on purpose. "3 days ago" is what a reader needs from a commit
/// list; "3 days, 4 hours and 11 minutes ago" is the same fact costing four
/// times the width and reading as precision nobody asked for.
///
/// `now` is an argument because this is pure. A function that reads a clock
/// cannot be tested twice with the same answer.
export function ago(when: number, now: number): { n: number; unit: Unit } {
  const seconds = Math.max(0, Math.floor(now / 1000) - when);
  for (const [unit, size] of STEPS) {
    if (seconds >= size) return { n: Math.floor(seconds / size), unit };
  }
  return { n: seconds, unit: "second" };
}

export type Unit = "year" | "month" | "day" | "hour" | "minute" | "second";

/// Months before days, and a month is thirty days. Both are wrong by a
/// little and neither can be right: a calendar month has no length. The unit
/// is chosen for reading, not for arithmetic, and nothing downstream does
/// arithmetic with it.
const STEPS: [Unit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

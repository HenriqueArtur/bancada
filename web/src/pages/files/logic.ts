import { useEffect, useState } from "react";
import type { Track, Worktree } from "@/core/review";
import { loadPaths, loadWorktree } from "@/core/review";

const EMPTY: Worktree = { files: {}, dirs: {} };

/// What git says about the tree, and every path in it for searching.
///
/// The paths are fetched only once somebody types. In a repository they are
/// one `ls-files`, but anywhere else they are a walk, and a search box is not
/// a reason to enumerate a tree over an ssh connection before anybody asked
/// a question.
export function useTracking(project: string, wanted: boolean) {
  const [worktree, setWorktree] = useState<Worktree>(EMPTY);
  const [paths, setPaths] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    setWorktree(EMPTY);
    setPaths(null);
    loadWorktree(project)
      .then((w) => alive && setWorktree(w))
      // A project git has never been told about still has a tree worth
      // showing; only the colouring has no answer.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project]);

  useEffect(() => {
    if (!wanted || paths !== null) return;
    let alive = true;
    loadPaths(project)
      .then((p) => alive && setPaths(p))
      .catch(() => alive && setPaths([]));
    return () => {
      alive = false;
    };
  }, [project, wanted, paths]);

  return { worktree, paths };
}

/// What happened to one path, or `null` for one git has nothing to say about.
///
/// Walks the directories above it as well, because an ignored `target` is one
/// entry standing for forty thousand paths that have none.
export function trackOf(w: Worktree, path: string): Track | null {
  const own = w.files[path] ?? w.dirs[path];
  if (own) return own;

  let at = path;
  for (let cut = at.lastIndexOf("/"); cut !== -1; cut = at.lastIndexOf("/")) {
    at = at.slice(0, cut);
    const up = w.dirs[at];
    if (up) return up;
  }
  return null;
}

/// The state to colour a *directory* with, from what is under it.
///
/// A closed folder that says nothing is a folder you have to open to learn
/// anything, which is most of the reason to colour a tree at all. Conflict
/// outranks the rest, then what is new, then what merely changed — the same
/// order the file states are read in.
export function trackUnder(w: Worktree, dir: string): Track | null {
  const own = w.dirs[dir];
  if (own) return own;

  const inside = `${dir}/`;
  let best: Track | null = null;
  for (const [path, track] of Object.entries(w.files)) {
    if (!path.startsWith(inside)) continue;
    if (track === "ignored") continue;
    if (best === null || RANK[track] < RANK[best]) best = track;
  }
  return best;
}

const RANK: Record<Track, number> = {
  conflicted: 0,
  added: 1,
  untracked: 1,
  renamed: 2,
  deleted: 3,
  modified: 4,
  ignored: 5,
};

/// The paths a search term leaves, best first.
///
/// A file whose *name* matches beats one whose directory happens to. Typing
/// `review` while looking for `review.ts` should not hand you nine files
/// from a folder called review first.
export function search(paths: string[], query: string, most = 200): string[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  const hits = paths.filter((p) => p.toLowerCase().includes(needle));
  return hits
    .sort((a, b) => {
      const an = Number(leafOf(a).toLowerCase().includes(needle));
      const bn = Number(leafOf(b).toLowerCase().includes(needle));
      return bn - an || a.length - b.length || a.localeCompare(b);
    })
    .slice(0, most);
}

export function leafOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

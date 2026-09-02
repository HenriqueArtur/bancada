import { useCallback, useEffect, useState } from "react";
import type { FileDiff, Hunk, ReviewView } from "@/core/review";
import { loadReview, markSeen, unmarkSeen } from "@/core/review";
import { paint } from "@/core/word-diff";
import type { CodeLine } from "@/components";

export interface Review {
  data: ReviewView | null;
  failed: string | null;
  /// Vouch for a file at the shape it currently has, or take that back.
  vouch: (f: FileDiff) => void;
}

export function useReview(project: string): Review {
  const [data, setData] = useState<ReviewView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    loadReview(project)
      .then(setData)
      .catch((e) => setFailed(String(e)));
  }, [project]);

  useEffect(load, [load]);

  const vouch = (f: FileDiff) => {
    // A toggle, because the control is a checkbox. Marking a file read is a
    // thing a person can be wrong about, and the only honest way to offer it
    // is to let them say so.
    if (f.fresh) markSeen(project, f.path, f.fingerprint);
    else unmarkSeen(project, f.path);
    load();
  };

  return { data, failed, vouch };
}

// ── the index ────────────────────────────────────────────────────────────

/// The extension a file filters under.
///
/// Three answers, the way GitHub's file filter has them: the extension, or
/// "dotfile" for something like `.gitignore` whose whole name is the
/// extension, or "none" for a `Makefile`. Lumping the last two into "no
/// extension" would put `Makefile` and `.gitignore` under one tick, and
/// they are not the same kind of file to anybody.
export function extensionOf(path: string): string {
  const name = leaf(path);
  const dot = name.lastIndexOf(".");
  if (dot === 0) return "dotfile";
  if (dot === -1) return "none";
  return name.slice(dot);
}

export interface Kind {
  ext: string;
  n: number;
}

/// Every extension present in this change, commonest first.
///
/// Only what is here. A filter offering `.py` for a diff with no Python in
/// it is a tick that does nothing, and a list of every extension in the
/// world is not a list anybody reads.
export function kinds(files: FileDiff[]): Kind[] {
  const seen = new Map<string, number>();
  for (const f of files) {
    const ext = extensionOf(f.path);
    seen.set(ext, (seen.get(ext) ?? 0) + 1);
  }
  return [...seen.entries()]
    .map(([ext, n]) => ({ ext, n }))
    .sort((a, b) => b.n - a.n || a.ext.localeCompare(b.ext));
}

export interface Filters {
  /// Extensions to keep. `null` is "every kind", which is not the same as
  /// the set of all of them: a file whose kind appears after the filter was
  /// opened would be missing from an explicit set and silently hidden.
  exts: string[] | null;
  query: string;
  hideViewed: boolean;
  hideDeleted: boolean;
}

export const NOTHING_FILTERED: Filters = {
  exts: null,
  query: "",
  hideViewed: false,
  hideDeleted: false,
};

export function filtering(f: Filters): boolean {
  return f.exts !== null || f.query.trim() !== "" || f.hideViewed || f.hideDeleted;
}

/// The files the filters leave standing, in path order.
///
/// Path order and not reading order: this feeds a tree, and a tree whose
/// leaves are sorted by urgency puts `z.rs` above `a.rs` inside the same
/// directory for a reason nothing on screen explains.
export function sift(files: FileDiff[], f: Filters): FileDiff[] {
  const needle = f.query.trim().toLowerCase();
  return files
    .filter((x) => f.exts === null || f.exts.includes(extensionOf(x.path)))
    .filter((x) => !f.hideViewed || x.fresh)
    .filter((x) => !f.hideDeleted || x.status !== "deleted")
    .filter((x) => needle === "" || x.path.toLowerCase().includes(needle))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export interface Totals {
  files: number;
  added: number;
  removed: number;
}

/// The one line at the top: how much there is to read.
export function totals(files: FileDiff[]): Totals {
  return {
    files: files.length,
    added: files.reduce((n, f) => n + f.added, 0),
    removed: files.reduce((n, f) => n + f.removed, 0),
  };
}

// ── the tree ─────────────────────────────────────────────────────────────

export type Node =
  | { kind: "dir"; name: string; path: string; children: Node[] }
  | { kind: "file"; file: FileDiff };

/// The changed files as a tree, with single-child chains collapsed.
///
/// The collapsing is the part that matters. Without it `web/src/pages/review`
/// is four nested rows, three of which hold nothing but the next one, and
/// reaching the file that changed costs three clicks spent on scenery. Joined
/// into one row it costs none, and the row still says the whole path.
export function tree(files: FileDiff[]): Node[] {
  const root: Node[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let into = root;
    let here = "";
    for (const name of parts.slice(0, -1)) {
      here = here === "" ? name : `${here}/${name}`;
      const at = here;
      let dir = into.find((n) => n.kind === "dir" && n.path === at);
      if (!dir) {
        dir = { kind: "dir", name, path: here, children: [] };
        into.push(dir);
      }
      into = (dir as Extract<Node, { kind: "dir" }>).children;
    }
    into.push({ kind: "file", file });
  }

  return tidy(root);
}

/// Directories before files, each by name, and every chain joined.
function tidy(nodes: Node[]): Node[] {
  const out = nodes
    .map((n) => {
      if (n.kind !== "dir") return n;
      let dir = { ...n, children: tidy(n.children) };
      // A directory whose only child is a directory is not a level anybody
      // navigates; it is a prefix of the one below it.
      while (dir.children.length === 1 && dir.children[0].kind === "dir") {
        const only = dir.children[0];
        dir = {
          kind: "dir",
          name: `${dir.name}/${only.name}`,
          path: only.path,
          children: only.children,
        };
      }
      return dir;
    })
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      const an = a.kind === "dir" ? a.name : leaf(a.file.path);
      const bn = b.kind === "dir" ? b.name : leaf(b.file.path);
      return an.localeCompare(bn);
    });
  return out;
}

/// Every directory path in a tree — what "expand everything" expands.
export function branches(nodes: Node[]): string[] {
  return nodes.flatMap((n) => (n.kind === "dir" ? [n.path, ...branches(n.children)] : []));
}

/// The last segment of a path — what the row in the tree is called.
export function leaf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

// ── how much of a file to show ───────────────────────────────────────────

/// Changed lines past which a file opens closed.
const A_LOT = 400;
/// Hunks past which it does too, however small each one is.
const MANY = 25;

/// Is this file large enough that opening it whole would bury the others?
///
/// A generated lockfile or a formatting sweep is thousands of lines nobody
/// reads, arriving in the same list as the four lines that matter. It still
/// gets a row, a count and a way in — what it does not get is the scroll.
export function tooBig(f: FileDiff): boolean {
  return f.added + f.removed > A_LOT || f.hunks.length > MANY;
}

/// Changed lines a page will render before the rest arrive folded.
///
/// Not a limit on the diff — every file still gets its header, its counts
/// and its fold. It is a limit on how much is *painted at once*: the whole
/// change of a working morning is tens of thousands of lines, each of them a
/// row with per-token spans in it, and a page that tries to draw all of it
/// stops responding before it finishes.
const A_PAGEFUL = 1200;

/// Which files arrive with their diff showing.
///
/// Down the list in the order it is read, spending a budget. What runs out
/// is the drawing, not the reading: a folded file is one click from open,
/// and the click costs nothing because only that file paints.
export function openOnArrival(files: FileDiff[]): Set<string> {
  const open = new Set<string>();
  let left = A_PAGEFUL;
  for (const f of files) {
    // Vouched for, or large enough to speak for itself. Both already have
    // their own reason to arrive folded, and neither should spend budget
    // that a file you have not read could use.
    if (!f.fresh || tooBig(f)) continue;
    if (left <= 0) continue;
    left -= f.added + f.removed;
    open.add(f.path);
  }
  return open;
}

export interface Gap {
  /// 1-based and inclusive, in the file as it is now.
  from: number;
  to: number;
}

/// The unchanged lines hidden immediately above hunk `i`.
///
/// Only above, and never below the last hunk: the length of the file is not
/// in the diff, so an expander at the bottom would be a button that cannot
/// say how much it will show and might show nothing. The whole file is one
/// tab away, and a control that sometimes does nothing is worse than a
/// control that is not there.
export function gapAbove(hunks: Hunk[], i: number): Gap | null {
  const here = hunks[i];
  if (!here || here.newStart === 0) return null;

  const above = hunks[i - 1];
  if (i > 0 && (!above || above.newStart === 0)) return null;
  const from = i === 0 ? 1 : above.newStart + above.newLines;

  const to = here.newStart - 1;
  return from > to ? null : { from, to };
}

/// The lines of `text` that a gap covers, 1-based and inclusive.
export function slice(text: string, gap: Gap): string[] {
  return text.split("\n").slice(gap.from - 1, gap.to);
}

// ── what the pane actually renders ───────────────────────────────────────

/// A hunk's lines, numbered on both sides and marked inside where it helps.
///
/// The numbers are walked rather than stored, because a diff does not carry
/// them: `@@` gives the two starting points and every line after that is
/// arithmetic. A removed line has no number in the new file and an added one
/// has none in the old, and saying so with a blank is the only way the two
/// columns stay honest.
export function rows(h: Hunk): CodeLine[] {
  let old = h.oldStart;
  let now = h.newStart;
  return paint(h.lines).map((l) => ({
    kind: l.kind,
    text: l.text,
    parts: l.parts,
    oldNo: l.kind === "added" ? null : old++,
    newNo: l.kind === "removed" ? null : now++,
  }));
}

/// The unchanged lines of a gap, read out of the file as it stands.
///
/// Both columns get a number. Nothing changes inside a gap, so the distance
/// between the two sides is constant across it and equal to what it is at
/// the top of the hunk underneath — which is the only place either number is
/// written down.
export function gapRows(text: string, gap: Gap, below: Hunk): CodeLine[] {
  const drift = below.newStart - below.oldStart;
  return slice(text, gap).map((line, i) => ({
    kind: "context" as const,
    text: line,
    oldNo: gap.from + i - drift,
    newNo: gap.from + i,
  }));
}

/// The review half of the cockpit: what changed, beside what was promised.
import { invoke } from "@tauri-apps/api/core";

export type LineKind = "added" | "removed" | "context";

export interface Line {
  kind: LineKind;
  text: string;
}

export interface Hunk {
  header: string;
  /// Where the hunk sits in each side of the file, 1-based, from `@@`.
  /// Zero when git printed a header this side could not read — which is the
  /// signal to offer no expander rather than to expand the wrong lines.
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Line[];
}

export type Status = "added" | "modified" | "deleted" | "renamed";

export interface FileDiff {
  path: string;
  added: number;
  removed: number;
  /// What happened to the file. A deleted file and a heavily cut one both
  /// read as "−300" and are not the same news.
  status: Status;
  /// Where a renamed file used to be. `null` for everything else.
  from: string | null;
  hunks: Hunk[];
  /// Changes when the file's diff changes. What "already reviewed" is
  /// pinned to, so acknowledging a file does not silence its next edit.
  fingerprint: string;
  fresh: boolean;
}

export interface Diff {
  files: FileDiff[];
}

/// How much has moved, in three numbers.
///
/// Its own call rather than a corner of the review: the footer sits on all
/// four screens, and the tree screen asking for thirty thousand lines of
/// hunks to print "12 files" is the payload mistake this codebase already
/// made once.
export interface Summary {
  files: number;
  added: number;
  removed: number;
}

export const loadSummary = (project: string): Promise<Summary> =>
  invoke<Summary>("summary", { project });

/// One turn's claim, and the session it came from.
///
/// A turn and not a session. A session is an afternoon of them, and one
/// claim for the whole log freezes at the first thing ever said.
export interface Told {
  session: string;
  intent: string | null;
  touched: string[];
  /// Milliseconds, so several sessions read in one order.
  at: number;
}

export interface ReviewView {
  diff: Diff;
  /// Newest first.
  told: Told[];
  unreachable: string | null;
}

export interface Entry {
  path: string;
  name: string;
  isDir: boolean;
}

/// What this human has already looked at, path to fingerprint.
///
/// Kept in the webview rather than in the core, and deliberately so: a
/// review is something a person did, and a record the product keeps on their
/// behalf is a record a restart can forge.
const SEEN_KEY = "bancada.seen";

type Store = Record<string, Record<string, string>>;

function read(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    return typeof raw === "object" && raw !== null ? (raw as Store) : {};
  } catch {
    return {};
  }
}

function write(all: Store): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    // A cockpit that cannot remember is only worse than one that crashes if
    // it pretends otherwise; the file simply stays marked fresh.
  }
}

export function seenOf(project: string): Record<string, string> {
  return read()[project] ?? {};
}

export function markSeen(project: string, path: string, fingerprint: string): void {
  const all = read();
  all[project] = { ...(all[project] ?? {}), [path]: fingerprint };
  write(all);
}

/// Take back a review of one file.
///
/// The checkbox beside a file can be unticked, so this has to exist: a
/// control that looks reversible and is not teaches the reader that the
/// product's state is not theirs to correct.
export function unmarkSeen(project: string, path: string): void {
  const all = read();
  const mine = all[project];
  if (!mine) return;
  delete mine[path];
  write(all);
}

export function forgetSeen(project: string): void {
  const all = read();
  delete all[project];
  write(all);
}

export const loadReview = (project: string): Promise<ReviewView> =>
  invoke<ReviewView>("review", { project, seen: seenOf(project) });

export const loadTree = (project: string, sub?: string): Promise<Entry[]> =>
  invoke<Entry[]>("tree", { project, sub: sub ?? null });

export const loadFile = (project: string, path: string): Promise<string> =>
  invoke<string>("file", { project, path });

/// What git says about each path in a project's tree.
export type Track =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored"
  | "conflicted";

export interface Worktree {
  files: Record<string, Track>;
  /// Directories git reported wholesale, without their trailing slash. An
  /// ignored `target` stands for everything beneath it, and git prints none
  /// of those.
  dirs: Record<string, Track>;
}

export const loadWorktree = (project: string): Promise<Worktree> =>
  invoke<Worktree>("worktree", { project });

/// Every file in the project, for searching by path.
export const loadPaths = (project: string): Promise<string[]> =>
  invoke<string[]>("paths", { project });

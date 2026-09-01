/// The review half of the cockpit: what changed, beside what was promised.
import { invoke } from "@tauri-apps/api/core";
import type { Translate } from "@/core/language";

export type LineKind = "added" | "removed" | "context";

export interface Line {
  kind: LineKind;
  text: string;
}

export interface Hunk {
  header: string;
  lines: Line[];
}

export interface FileDiff {
  path: string;
  added: number;
  removed: number;
  hunks: Hunk[];
  /// Changes when the file's diff changes. What "already reviewed" is
  /// pinned to, so acknowledging a file does not silence its next edit.
  fingerprint: string;
  fresh: boolean;
}

export interface Diff {
  files: FileDiff[];
}

export interface SessionReview {
  session: string;
  intent: string | null;
  touched: string[];
}

export interface ReviewView {
  diff: Diff;
  sessions: SessionReview[];
  /// Changed in the tree and named by no session's announcement.
  unannounced: string[];
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

/// `+12 −3`, or the honest words for a file with no line changes.
export function churn(f: Pick<FileDiff, "added" | "removed">, t: Translate): string {
  if (f.added === 0 && f.removed === 0) return t("no lines");
  return `+${f.added} −${f.removed}`;
}

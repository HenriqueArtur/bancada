/// Everything registered, grouped the way the boundary actually runs.
import { invoke } from "@tauri-apps/api/core";
import type { Translate } from "@/core/language";
import type { Config, Project, Workspace } from "@/core/settings";

/// One project, and whether it is alive.
export interface Standing {
  project: Project;
  /// Sessions the harness has recorded here. Counted, never read.
  sessions: number;
  /// When the most recent one was last written, in epoch milliseconds.
  lastActivity: number | null;
  unreachable: string | null;
}

export interface Grouped {
  workspace: Workspace;
  projects: Standing[];
}

export interface Work {
  workspaces: Grouped[];
  /// Projects naming a workspace that is not registered. The configuration
  /// refuses to parse with one, but a screen that silently drops a project
  /// is worse than one that says it found an orphan.
  orphans: Standing[];
}

export const loadWork = (): Promise<Work> => invoke<Work>("work");
export const registerWorkspace = (workspace: Workspace, previous?: string): Promise<Config> =>
  invoke<Config>("register_workspace", { workspace, previous: previous ?? null });
export const forgetWorkspace = (id: string): Promise<Config> =>
  invoke<Config>("forget_workspace", { id });

/// What the export level lets out, in the words it means.
///
/// `metadata` is where a workspace is born and it is the closed one, which
/// the word does not say on its own — a label nobody can read is a boundary
/// nobody checks.
export function exportsAs(w: Workspace, t: Translate): string {
  switch (w.export) {
    case "summary":
      return t("Exports summaries");
    case "full":
      return t("Exports everything");
    // A workspace is born here and rises by a deliberate act, never by
    // default — so an absent level and `metadata` are the same closed thing.
    default:
      return t("Sealed · metadata only");
  }
}

/// How long ago, in the words a person uses. `null` when nothing happened.
export function since(at: number | null, now: number, t: Translate): string | null {
  if (at === null) return null;
  const m = Math.floor((now - at) / 60_000);
  if (m < 1) return t("just now");
  if (m < 60) return t("{n} min ago", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("{n}h ago", { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("yesterday") : t("{n} days ago", { n: d });
}

/// What to say about a project's activity, including when there is none.
export function aliveness(s: Standing, now: number, t: Translate): string {
  if (s.unreachable) return s.unreachable;
  if (s.sessions === 0) return t("Nothing recorded yet");
  const ago = since(s.lastActivity, now, t);
  const sessions = t.plural(s.sessions, "{n} session", "{n} sessions");
  return ago ? t("{sessions} · last {ago}", { sessions, ago }) : sessions;
}

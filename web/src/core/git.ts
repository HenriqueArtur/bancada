/// The repository's own account of itself: what landed, and where you are.
import { invoke } from "@tauri-apps/api/core";
import type { Diff } from "@/core/review";

export interface Commit {
  sha: string;
  short: string;
  author: string;
  /// Seconds since the epoch. A number and not a formatted string: how a
  /// date should read is the reader's locale and the reader's clock, and
  /// neither is knowable on the other side of the seam.
  when: number;
  subject: string;
}

export interface Branch {
  name: string;
  head: string;
  current: boolean;
}

export interface Repo {
  isGit: boolean;
  head: string | null;
  ahead: number;
  behind: number;
}

export interface Landed {
  commit: Commit;
  /// The message below the subject line, whole. Empty for a commit that has
  /// only a subject.
  body: string;
  diff: Diff;
}

/// How many commits a page of the history holds.
export const A_PAGE = 30;

export const loadRepo = (project: string): Promise<Repo> => invoke<Repo>("repo", { project });

export const loadHistory = (project: string, skip: number): Promise<Commit[]> =>
  invoke<Commit[]>("history", { project, skip, take: A_PAGE });

export const loadBranches = (project: string): Promise<Branch[]> =>
  invoke<Branch[]>("branches", { project });

export const loadCommit = (project: string, sha: string): Promise<Landed> =>
  invoke<Landed>("commit", { project, sha });

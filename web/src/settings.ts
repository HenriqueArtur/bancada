/// What the product was told, and nothing it guessed.
import { invoke } from "@tauri-apps/api/core";

export interface Workspace {
  id: string;
  export?: "sealed" | "summary" | "full";
}

export interface RuntimeSpec {
  id: string;
  /// `local`, `vm`, `container`, `ssh` — a label, not a switch.
  kind: string;
  prefix: string[];
  hostRoot: string;
  guestRoot: string;
  configDir: string;
  sharedFs: boolean;
}

export interface Project {
  id: string;
  workspace: string;
  runtime: string;
  /// The path as the *guest* spells it — which is how the log spells it.
  path: string;
  weight: number;
  idleAfterMinutes: number;
}

export interface Config {
  workspaces: Workspace[];
  runtimes: RuntimeSpec[];
  projects: Project[];
}

export interface Account {
  uuid: string;
  email: string;
  organization: string;
}

export interface Harness {
  path: string;
  version: string;
  loggedIn: boolean;
  account: Account | null;
}

export interface Discovery {
  runtime: string;
  harness: Harness | null;
  /// Named rather than silent: a runtime that could not be probed looks
  /// exactly like one with nothing installed.
  error: string | null;
}

export const loadSettings = (): Promise<Config> => invoke<Config>("settings");
export const discover = (): Promise<Discovery[]> => invoke<Discovery[]>("discover");
export const registerProject = (project: Project): Promise<Config> =>
  invoke<Config>("register_project", { project });
export const forgetProject = (id: string): Promise<Config> =>
  invoke<Config>("forget_project", { id });

/// The reserved id of the machine bancada is running on.
///
/// Always present, never written to the configuration file. Persisting it
/// would freeze today's `$HOME` into a file that outlives it.
export const THIS_MACHINE = "this-machine";

export const BLANK: Project = {
  id: "",
  workspace: "",
  // Preselected because it is the answer most of the time and it is never
  // wrong to *offer*: the product is already running there.
  runtime: THIS_MACHINE,
  path: "",
  weight: 1,
  idleAfterMinutes: 2,
};

/// Why this project cannot be registered yet, in the order a person fills
/// the form in.
///
/// Returned rather than thrown, and one reason at a time: a form that
/// lights up four errors at once is one people stop reading.
export function whyNot(p: Project, config: Config): string | null {
  if (!p.id.trim()) return "give it a name";
  if (!p.path.trim()) return "where does it live, as the guest spells it?";
  if (!p.path.startsWith("/")) return "the path must be absolute";
  if (!p.runtime) return "which runtime runs it?";
  if (!p.workspace) return "whose work is this?";
  if (!config.runtimes.some((r) => r.id === p.runtime)) {
    return `no runtime registered as ${p.runtime}`;
  }
  if (!config.workspaces.some((w) => w.id === p.workspace)) {
    return `no workspace registered as ${p.workspace}`;
  }
  if (p.weight < 1) return "weight 0 would erase the project from the order";
  return null;
}

/// The directory the harness keeps this project's logs in.
///
/// Shown while typing so the registration can be checked before it is
/// saved. **Computed, never decoded** — the encoding turns both `/` and `.`
/// into `-`, so reading a directory name back would be a guess that is
/// right most of the time.
export function logDirName(path: string): string {
  return path.replace(/[/.]/g, "-");
}

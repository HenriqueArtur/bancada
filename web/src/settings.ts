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

/// What a registration would actually be watching, before it is made.
export interface Preview {
  sessions: number;
  reachable: boolean;
  versioned: boolean;
  logDir: string;
  why: string | null;
}

export const loadSettings = (): Promise<Config> => invoke<Config>("settings");
export const previewProject = (path: string, runtime: string): Promise<Preview> =>
  invoke<Preview>("preview", { path, runtime });
export const registerRuntime = (runtime: RuntimeSpec): Promise<Config> =>
  invoke<Config>("register_runtime", { runtime });
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
/// **Computed, never decoded** — the encoding turns both `/` and `.` into
/// `-`, so reading a directory name back would be a guess that is right most
/// of the time. Kept because the core computes the same thing and the two
/// must agree; shown only in the small print, never as the confirmation.
export function logDirName(path: string): string {
  return path.replace(/[/.]/g, "-");
}

/// A project name from the folder it lives in.
///
/// The last segment, and nothing clever. Somebody who wants a different
/// name types one; somebody who does not should not have to invent one.
export function nameFrom(path: string): string {
  return path.replace(/\/+$/, "").split("/").pop() ?? "";
}

/// What the evidence line says, and how loudly.
export function evidenceOf(p: Preview | null): {
  tone: "found" | "empty" | "missing";
  says: string;
} | null {
  if (!p) return null;
  if (!p.reachable) {
    return { tone: "missing", says: p.why ?? "cannot reach that folder" };
  }
  if (p.sessions === 0) {
    return {
      tone: "empty",
      says: "reachable, and no sessions recorded here yet",
    };
  }
  return {
    tone: "found",
    says: `${p.sessions} session${p.sessions === 1 ? "" : "s"} already recorded here`,
  };
}

export const BLANK_RUNTIME: RuntimeSpec = {
  id: "",
  kind: "vm",
  prefix: [],
  hostRoot: "/",
  guestRoot: "/",
  configDir: "",
  sharedFs: true,
};

/// Why this runtime cannot be registered yet.
export function whyNotRuntime(r: RuntimeSpec, config: Config): string | null {
  // Worded apart from the project's own "give it a name" on purpose: both
  // forms are on one screen, and two identical complaints leave you looking
  // for which field is unhappy.
  if (!r.id.trim()) return "give the machine a name";
  if (r.id === THIS_MACHINE) return "that name belongs to the machine bancada runs on";
  if (config.runtimes.some((x) => x.id === r.id)) return `${r.id} is already registered`;
  if (!r.configDir.trim()) return "where does the harness keep its state, as this machine spells it?";
  if (!r.configDir.startsWith("/")) return "that path must be absolute";
  if (r.prefix.length === 0) return "what goes in front of every command?";
  return null;
}

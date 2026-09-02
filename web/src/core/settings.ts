/// What the product was told, and nothing it guessed.
import { invoke } from "@tauri-apps/api/core";
import type { Translate } from "@/core/language";

export interface Workspace {
  id: string;
  /// What the *other* workspaces' supervisors may read from this one.
  ///
  /// Spelled the way the core serialises it. This said `sealed` once, which
  /// is the word a person would choose and not a word the configuration has
  /// ever contained — so nothing matched and the level always read as its
  /// default.
  export?: "metadata" | "summary" | "full";
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
  /// Which harness runs here, and which model it is set to.
  ///
  /// Declared rather than probed. The probe can read a version off the
  /// binary but not which model you have it pointed at, and a header that
  /// named the harness and guessed the model would be right about the half
  /// nobody was asking about. `null` where you have not said.
  harness: string | null;
  model: string | null;
}

export interface Project {
  id: string;
  workspace: string;
  runtime: string;
  /// The path as the *guest* spells it — which is how the log spells it.
  path: string;
  weight: number;
  idleAfterMinutes: number;
  /// Set while the project is not allowed to ask for you.
  ///
  /// Carries when you silenced it and how much work it had then, because a
  /// session that did not exist then wakes it on its own — you silence a
  /// project when the work ends, and forgetting to un-silence it is the
  /// failure an attention supervisor exists to prevent.
  muted?: { at: number; sessions: number } | null;
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
export const registerProject = (project: Project, previous?: string): Promise<Config> =>
  invoke<Config>("register_project", { project, previous: previous ?? null });
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
export function whyNot(
  p: Project,
  config: Config,
  t: Translate,
  previous?: string,
): string | null {
  if (!p.id.trim()) return t("give it a name");
  if (p.id !== previous && config.projects.some((x) => x.id === p.id)) {
    return t("{id} is already registered", { id: p.id });
  }
  if (!p.path.trim()) return t("where does it live, as the guest spells it?");
  if (!p.path.startsWith("/")) return t("the path must be absolute");
  if (!p.runtime) return t("which runtime runs it?");
  if (!p.workspace) return t("whose work is this?");
  if (!config.runtimes.some((r) => r.id === p.runtime)) {
    return t("no runtime registered as {id}", { id: p.runtime });
  }
  if (!config.workspaces.some((w) => w.id === p.workspace)) {
    return t("no workspace registered as {id}", { id: p.workspace });
  }
  // The path is written the way the machine running it spells one, and the
  // two spellings look alike enough to swap by accident — the form is filled
  // top to bottom, so the path is often typed while the machine is still the
  // default. Caught here, because the failure otherwise is silent: the
  // product looks for logs in a directory computed from the wrong path,
  // finds none, and shows an empty project.
  const runs = config.runtimes.find((r) => r.id === p.runtime);
  if (runs && runs.guestRoot !== "/" && !under(p.path, runs.guestRoot)) {
    return t("{id} spells its shared folder {root}, and this is not under it", {
      id: p.runtime,
      root: runs.guestRoot,
    });
  }
  if (p.weight < 1) return t("weight 0 would erase the project from the order");
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
export function evidenceOf(
  p: Preview | null,
  t: Translate,
): {
  tone: "found" | "empty" | "missing";
  says: string;
} | null {
  if (!p) return null;
  if (!p.reachable) {
    return { tone: "missing", says: p.why ?? t("cannot reach that folder") };
  }
  if (p.sessions === 0) {
    return {
      tone: "empty",
      says: t("reachable, and no sessions recorded here yet"),
    };
  }
  return {
    tone: "found",
    says: t.plural(
      p.sessions,
      "{n} session already recorded here",
      "{n} sessions already recorded here",
    ),
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
  // Blank rather than guessed. The header stays quiet until you say.
  harness: null,
  model: null,
};

/// Why this runtime cannot be registered yet.
export function whyNotRuntime(r: RuntimeSpec, config: Config, t: Translate): string | null {
  // Worded apart from the project's own "give it a name" on purpose: both
  // forms are on one screen, and two identical complaints leave you looking
  // for which field is unhappy.
  if (!r.id.trim()) return t("give the machine a name");
  if (r.id === THIS_MACHINE) return t("that name belongs to the machine bancada runs on");
  if (config.runtimes.some((x) => x.id === r.id))
    return t("{id} is already registered", { id: r.id });
  if (!r.configDir.trim())
    return t("where does the harness keep its state, as this machine spells it?");
  if (!r.configDir.startsWith("/")) return t("that path must be absolute");
  if (r.prefix.length === 0) return t("what goes in front of every command?");
  return null;
}

/// Whether a path sits inside a directory, by segment.
///
/// By segment and not by prefix: `/mnt/development` starts with the letters
/// of `/mnt/dev` and is somewhere else entirely.
function under(path: string, root: string): boolean {
  const at = root.endsWith("/") ? root : `${root}/`;
  return path === root || path.startsWith(at);
}

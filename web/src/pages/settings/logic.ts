import { useCallback, useEffect, useState } from "react";
import type { Config, Preview, Project, RuntimeSpec, Workspace } from "@/core/settings";
import { forgetWorkspace, registerWorkspace } from "@/core/work";
import {
  BLANK,
  discover,
  forgetProject,
  loadSettings,
  nameFrom,
  previewProject,
  registerProject,
  registerRuntime,
  type Discovery,
} from "@/core/settings";

export interface Settings {
  config: Config | null;
  failed: string | null;
  register: (p: Project, previous?: string) => void;
  forget: (id: string) => void;
  addRuntime: (r: RuntimeSpec) => void;
  addWorkspace: (w: Workspace, previous?: string) => void;
  dropWorkspace: (id: string) => void;
}

export function useSettings(onChanged?: () => void): Settings {
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    loadSettings()
      .then(setConfig)
      .catch((e) => setFailed(String(e)));
  }, []);

  const apply = (next: Promise<Config>) =>
    next
      .then((c) => {
        setConfig(c);
        setFailed(null);
        onChanged?.();
      })
      .catch((e) => setFailed(String(e)));

  return {
    config,
    failed,
    register: (p, previous) => void apply(registerProject(p, previous)),
    forget: (id) => void apply(forgetProject(id)),
    addRuntime: (r) => void apply(registerRuntime(r)),
    addWorkspace: (w, previous) => void apply(registerWorkspace(w, previous)),
    dropWorkspace: (id) => void apply(forgetWorkspace(id)),
  };
}

/// The draft of a project, and what watching it would actually mean.
///
/// The preview is looked up as you type, debounced, and only when there is
/// something to look up. Kept out of the view so the debounce and the
/// auto-naming can be read in one place.
export function useDraftProject() {
  const [draft, setDraft] = useState<Project>(BLANK);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!draft.path.startsWith("/") || !draft.runtime) {
      setPreview(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      previewProject(draft.path, draft.runtime)
        .then((p) => alive && setPreview(p))
        .catch(() => alive && setPreview(null));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [draft.path, draft.runtime]);

  /// Setting the path also names the project, unless you already named it.
  const setPath = (path: string) =>
    setDraft((d) => ({ ...d, path, id: d.id || nameFrom(path) }));

  const clear = () => {
    setDraft(BLANK);
    setPreview(null);
  };

  /// Fill the form from something already registered.
  ///
  /// Wrapped in `useCallback` because an effect depends on it: a new
  /// identity every render would reload the draft on every keystroke and
  /// undo the typing.
  const load = useCallback((p: Project) => setDraft(p), []);

  return { draft, setDraft, setPath, preview, clear, load };
}

/// Probing shells into every VM, so it never runs on open.
export function useDiscovery() {
  const [found, setFound] = useState<Discovery[] | null>(null);
  const [probing, setProbing] = useState(false);

  const probe = () => {
    setProbing(true);
    discover()
      .then(setFound)
      .catch((e) => setFound([{ runtime: "—", harness: null, error: String(e) }]))
      .finally(() => setProbing(false));
  };

  return { found: new Map((found ?? []).map((d) => [d.runtime, d])), probing, probe };
}

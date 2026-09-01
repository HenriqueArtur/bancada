import { useEffect, useState } from "react";
import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import type { Config, Discovery, Preview, Project, RuntimeSpec } from "../settings";
import {
  BLANK,
  BLANK_RUNTIME,
  THIS_MACHINE,
  discover,
  evidenceOf,
  forgetProject,
  loadSettings,
  logDirName,
  nameFrom,
  previewProject,
  registerProject,
  registerRuntime,
  whyNot,
  whyNotRuntime,
} from "../settings";

/// Registration, and what the machines say they have.
///
/// The two halves are deliberately separate. Discovery **proposes** — it
/// reads what is installed and which account is logged in — and registering
/// is a human act. Forty containers would hide the three that matter, so
/// nothing reaches the queue because it merely exists.
export function SettingsScreen({ onChanged }: { onChanged?: () => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then(setConfig).catch((e) => setFailed(String(e)));
  }, []);

  if (failed) return <div className="unreachable">{failed}</div>;
  if (!config) return <p className="quiet">reading the configuration…</p>;

  const apply = (next: Promise<Config>) =>
    next
      .then((c) => {
        setConfig(c);
        setFailed(null);
        onChanged?.();
      })
      .catch((e) => setFailed(String(e)));

  return (
    <>
      <h2>projects</h2>
      <ProjectList config={config} onForget={(id) => apply(forgetProject(id))} />
      <RegisterProject config={config} onRegister={(p) => apply(registerProject(p))} />

      <h2>runtimes</h2>
      <RuntimeList config={config} />
      <RegisterRuntime config={config} onRegister={(r) => apply(registerRuntime(r))} />
    </>
  );
}

function ProjectList({
  config,
  onForget,
}: {
  config: Config;
  onForget: (id: string) => void;
}) {
  if (config.projects.length === 0) {
    return <p className="quiet">nothing registered yet</p>;
  }
  return (
    <table className="rows">
      <tbody>
        {config.projects.map((p) => (
          <tr key={p.id}>
            <td className="strong">{p.id}</td>
            <td className="mono">{p.path}</td>
            <td>{p.runtime === THIS_MACHINE ? "this machine" : p.runtime}</td>
            <td title="how fast waiting hurts here">×{p.weight}</td>
            <td>
              <button type="button" onClick={() => onForget(p.id)}>
                forget
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/// Pick a folder, and be shown what watching it would mean.
///
/// The old form asked for six fields and confirmed with a line of encoded
/// directory name. That is jargon asking a person to check something the
/// product can check itself. Now the folder comes from the system picker,
/// the name comes from the folder, and the confirmation is evidence: *four
/// sessions already recorded here*. Everything that has a sane default is
/// behind one disclosure.
function RegisterProject({
  config,
  onRegister,
}: {
  config: Config;
  onRegister: (p: Project) => void;
}) {
  const [draft, setDraft] = useState<Project>(BLANK);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picking, setPicking] = useState(false);

  // Looked up as you type, and only when there is something to look up.
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

  const local = draft.runtime === THIS_MACHINE;
  const blocked = whyNot(draft, config);
  const evidence = evidenceOf(preview);

  const browse = async () => {
    setPicking(true);
    try {
      const chosen = await pickFolder({ directory: true, multiple: false });
      if (typeof chosen === "string") {
        setDraft((d) => ({ ...d, path: chosen, id: d.id || nameFrom(chosen) }));
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    <form
      className="card register"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) {
          onRegister(draft);
          setDraft(BLANK);
          setPreview(null);
        }
      }}
    >
      <label className="wide">
        <span>where does it live?</span>
        <div className="actions" style={{ margin: 0 }}>
          <input
            value={draft.path}
            placeholder={local ? "/Users/you/dev/thing" : "the path as the guest spells it"}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                path: e.target.value,
                id: d.id || nameFrom(e.target.value),
              }))
            }
            style={{ flex: 1 }}
          />
          {/* Only for this machine. A guest path cannot be browsed from
              here, and a picker that quietly returns the host's spelling of
              it would register something that does not exist. */}
          {local ? (
            <button type="button" className="secondary" onClick={browse} disabled={picking}>
              {picking ? "…" : "browse"}
            </button>
          ) : null}
        </div>
      </label>

      {evidence ? (
        <p className={`evidence ${evidence.tone}`}>
          <span>{evidence.says}</span>
          {preview && !preview.versioned && preview.reachable ? (
            <span className="mono">· not a git repository, so no diff to review</span>
          ) : null}
        </p>
      ) : null}

      <label>
        <span>call it</span>
        <input
          value={draft.id}
          placeholder="from the folder name"
          onChange={(e) => setDraft({ ...draft, id: e.target.value })}
        />
      </label>

      <Pick
        label="runs on"
        value={draft.runtime}
        options={config.runtimes.map((r) => r.id)}
        onChange={(runtime) => setDraft({ ...draft, runtime })}
      />

      <details className="advanced">
        <summary>whose it is, and how fast waiting hurts</summary>
        <div>
          <Pick
            label="workspace"
            value={draft.workspace}
            options={config.workspaces.map((w) => w.id)}
            onChange={(workspace) => setDraft({ ...draft, workspace })}
          />
          <Field
            label="weight"
            value={String(draft.weight)}
            onChange={(v) => setDraft({ ...draft, weight: Number(v) || 1 })}
          />
          <Field
            label="quiet for (minutes) before it counts"
            value={String(draft.idleAfterMinutes)}
            onChange={(v) => setDraft({ ...draft, idleAfterMinutes: Number(v) || 1 })}
          />
          {draft.path ? (
            <p className="quiet mono" style={{ alignSelf: "end" }}>
              logs: projects/{logDirName(draft.path)}
            </p>
          ) : null}
        </div>
      </details>

      <div className="actions">
        <button type="submit" disabled={blocked !== null}>
          watch it
        </button>
        {blocked ? <span className="quiet">{blocked}</span> : null}
      </div>
    </form>
  );
}

function RuntimeList({ config }: { config: Config }) {
  const [found, setFound] = useState<Discovery[] | null>(null);
  const [probing, setProbing] = useState(false);

  const probe = () => {
    setProbing(true);
    discover()
      .then(setFound)
      .catch((e) => setFound([{ runtime: "—", harness: null, error: String(e) }]))
      .finally(() => setProbing(false));
  };

  const byId = new Map((found ?? []).map((d) => [d.runtime, d]));

  return (
    <>
      <table className="rows">
        <tbody>
          {config.runtimes.map((r) => {
            const d = byId.get(r.id);
            return (
              <tr key={r.id}>
                <td className="strong">{r.id}</td>
                <td>
                  {r.id === THIS_MACHINE ? (
                    // Not a proposal and not a declaration: the product is
                    // already executing here, so there is nothing to be
                    // wrong about and nothing to register.
                    <span className="badge">always here</span>
                  ) : (
                    r.kind
                  )}
                </td>
                <td className="mono">{r.prefix.join(" ") || "no prefix"}</td>
                <td>{d ? <Probed d={d} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="actions">
        <button type="button" className="secondary" onClick={probe} disabled={probing}>
          {probing ? "probing…" : "ask them what they have"}
        </button>
        <span className="quiet">discovery proposes; registering is yours</span>
      </div>
    </>
  );
}

/// A VM, a container or a host over ssh, described once.
///
/// Folded away until asked for. Most people register a runtime a handful of
/// times ever, and a six-field form sitting open under the projects makes
/// the common case look as hard as the rare one.
function RegisterRuntime({
  config,
  onRegister,
}: {
  config: Config;
  onRegister: (r: RuntimeSpec) => void;
}) {
  const [draft, setDraft] = useState<RuntimeSpec>(BLANK_RUNTIME);
  const blocked = whyNotRuntime(draft, config);

  return (
    <details className="advanced card">
      <summary>describe another machine</summary>
      <div>
        <Field label="call it" value={draft.id} onChange={(id) => setDraft({ ...draft, id })} />
        <Pick
          label="what kind"
          value={draft.kind}
          options={["vm", "container", "ssh", "local"]}
          onChange={(kind) => setDraft({ ...draft, kind })}
        />
        <Field
          label="what runs in front of every command"
          value={draft.prefix.join(" ")}
          onChange={(v) => setDraft({ ...draft, prefix: v.split(/\s+/).filter(Boolean) })}
        />
        <Field
          label="where the harness keeps state, as this machine spells it"
          value={draft.configDir}
          onChange={(configDir) => setDraft({ ...draft, configDir })}
        />
        <Field
          label="its tree, as this machine spells it"
          value={draft.hostRoot}
          onChange={(hostRoot) => setDraft({ ...draft, hostRoot })}
        />
        <Field
          label="the same tree, as it spells it"
          value={draft.guestRoot}
          onChange={(guestRoot) => setDraft({ ...draft, guestRoot })}
        />
        <div className="actions">
          <button
            type="button"
            disabled={blocked !== null}
            onClick={() => {
              onRegister(draft);
              setDraft(BLANK_RUNTIME);
            }}
          >
            register it
          </button>
          {blocked ? <span className="quiet">{blocked}</span> : null}
        </div>
      </div>
    </details>
  );
}

function Probed({ d }: { d: Discovery }) {
  if (d.error) return <span className="unreachable">{d.error}</span>;
  if (!d.harness) return <span className="quiet">no harness installed</span>;
  const who = d.harness.account;
  return (
    <span className="quiet">
      {d.harness.version}
      {d.harness.loggedIn ? "" : " · logged out"}
      {who ? ` · ${who.email}` : ""}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "this-machine" ? "this machine" : o}
          </option>
        ))}
      </select>
    </label>
  );
}

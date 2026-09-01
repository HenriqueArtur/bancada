import { useEffect, useState } from "react";
import type { Config, Discovery, Project } from "../settings";
import {
  BLANK,
  discover,
  forgetProject,
  loadSettings,
  logDirName,
  registerProject,
  whyNot,
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
  const [draft, setDraft] = useState<Project>(BLANK);

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

  const blocked = whyNot(draft, config);

  return (
    <>
      <h2>projects</h2>
      {config.projects.length === 0 ? (
        <p className="quiet">nothing registered yet</p>
      ) : (
        <table className="rows">
          <tbody>
            {config.projects.map((p) => (
              <tr key={p.id}>
                <td className="strong">{p.id}</td>
                <td className="mono">{p.path}</td>
                <td>{p.workspace}</td>
                <td>{p.runtime}</td>
                <td title="how fast waiting hurts here">×{p.weight}</td>
                <td>
                  <button type="button" onClick={() => setDraft(p)}>
                    edit
                  </button>
                  <button type="button" onClick={() => apply(forgetProject(p.id))}>
                    forget
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        className="register"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) apply(registerProject(draft)).then(() => setDraft(BLANK));
        }}
      >
        <Field label="name" value={draft.id} onChange={(id) => setDraft({ ...draft, id })} />
        <Field
          label="path, as the guest spells it"
          value={draft.path}
          onChange={(path) => setDraft({ ...draft, path })}
        />
        <Pick
          label="runtime"
          value={draft.runtime}
          options={config.runtimes.map((r) => r.id)}
          onChange={(runtime) => setDraft({ ...draft, runtime })}
        />
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
          label="idle after (min)"
          value={String(draft.idleAfterMinutes)}
          onChange={(v) => setDraft({ ...draft, idleAfterMinutes: Number(v) || 1 })}
        />

        {draft.path ? (
          // Shown before saving, because this is the one field that cannot
          // be checked by reading it back: the encoding is lossy.
          <p className="quiet mono">logs: projects/{logDirName(draft.path)}</p>
        ) : null}

        <div className="actions">
          <button type="submit" disabled={blocked !== null}>
            register
          </button>
          {blocked ? <span className="quiet">{blocked}</span> : null}
        </div>
      </form>

      <h2>runtimes</h2>
      <RuntimePanel config={config} />
    </>
  );
}

function RuntimePanel({ config }: { config: Config }) {
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
                <td>{r.kind}</td>
                <td className="mono">{r.prefix.join(" ") || "no prefix"}</td>
                <td>{r.sharedFs ? "shared fs" : "piped"}</td>
                <td>{d ? <Probed d={d} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="actions">
        <button type="button" onClick={probe} disabled={probing}>
          {probing ? "probing…" : "probe runtimes"}
        </button>
        <span className="quiet">
          discovery proposes; registering is yours
        </span>
      </div>
    </>
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
      {who ? ` · ${who.email} (${who.organization})` : ""}
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
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

import { useEffect, useState } from "react";
import type { Entry } from "../review";
import { loadTree } from "../review";

interface Props {
  project: string;
  onOpen: (path: string) => void;
  selected: string | null;
}

/// A directory at a time, expanded on demand.
///
/// Not a whole-tree walk: a repository with a `node_modules` in it hands
/// back a hundred thousand entries, and a pane that stalls on open has
/// stopped being part of a cockpit.
export function FileTree(props: Props) {
  return (
    <nav className="tree">
      <Level {...props} sub="" />
    </nav>
  );
}

function Level({ project, sub, onOpen, selected }: Props & { sub: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadTree(project, sub || undefined)
      .then((e) => alive && setEntries(e))
      .catch((e) => alive && setFailed(String(e)));
    return () => {
      alive = false;
    };
  }, [project, sub]);

  if (failed) return <p className="unreachable">{failed}</p>;
  if (!entries) return <p className="quiet">reading…</p>;

  const toggle = (path: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <ul>
      {entries.map((e) => (
        <li key={e.path}>
          {e.isDir ? (
            <>
              <button type="button" className="dir" onClick={() => toggle(e.path)}>
                {open.has(e.path) ? "▾" : "▸"} {e.name}
              </button>
              {open.has(e.path) ? (
                <Level project={project} sub={e.path} onOpen={onOpen} selected={selected} />
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className={`leaf${selected === e.path ? " selected" : ""}`}
              onClick={() => onOpen(e.path)}
            >
              {e.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

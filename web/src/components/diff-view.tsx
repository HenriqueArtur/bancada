import { useState } from "react";
import type { Diff, FileDiff } from "../review";
import { churn } from "../review";

interface Props {
  diff: Diff;
  /// Changed in the tree and announced by nobody. Shown first and marked,
  /// because in a long diff this is the short list worth reading.
  unannounced: string[];
  onSeen: (f: FileDiff) => void;
}

export function DiffView({ diff, unannounced, onSeen }: Props) {
  if (diff.files.length === 0) {
    return <p className="quiet">the tree matches its last commit</p>;
  }
  const surprising = new Set(unannounced);
  const ordered = [...diff.files].sort(
    (a, b) =>
      Number(surprising.has(b.path)) - Number(surprising.has(a.path)) ||
      Number(b.fresh) - Number(a.fresh) ||
      a.path.localeCompare(b.path),
  );

  return (
    <div className="diff">
      {ordered.map((f) => (
        <FileBlock
          key={f.path}
          file={f}
          unannounced={surprising.has(f.path)}
          onSeen={onSeen}
        />
      ))}
    </div>
  );
}

function FileBlock({
  file,
  unannounced,
  onSeen,
}: {
  file: FileDiff;
  unannounced: boolean;
  onSeen: (f: FileDiff) => void;
}) {
  // A file already reviewed opens collapsed. Nothing is hidden — the header
  // still names it — but the pane opens on what moved.
  const [open, setOpen] = useState(file.fresh);

  return (
    <section className={`file${file.fresh ? " fresh" : ""}`}>
      <header onClick={() => setOpen(!open)}>
        <span className="path">{file.path}</span>
        {unannounced ? (
          <span className="badge surprise" title="no session announced this file">
            unannounced
          </span>
        ) : null}
        {file.fresh ? <span className="badge new">new to you</span> : null}
        <span className="churn">{churn(file)}</span>
        <button
          type="button"
          className="seen"
          onClick={(e) => {
            e.stopPropagation();
            onSeen(file);
          }}
        >
          {file.fresh ? "mark reviewed" : "reviewed"}
        </button>
      </header>

      {open
        ? file.hunks.map((h, i) => (
            <pre key={i} className="hunk">
              <code className="header">{h.header}</code>
              {h.lines.map((l, j) => (
                <code key={j} className={l.kind}>
                  {l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}
                  {l.text}
                </code>
              ))}
            </pre>
          ))
        : null}
    </section>
  );
}

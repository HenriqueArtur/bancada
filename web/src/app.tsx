import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Queue } from "./queue";
import type { FileDiff, ReviewView } from "./review";
import { loadReview, markSeen } from "./review";
import { QueueGroup } from "./components/queue-group";
import { EmptyCockpit } from "./components/empty-cockpit";
import { WipBar } from "./components/wip-bar";
import { DiffView } from "./components/diff-view";
import { IntentPanel } from "./components/intent-panel";
import { FileTree } from "./components/file-tree";
import { CodeView } from "./components/code-view";
import { SettingsScreen } from "./components/settings-screen";

/// Polling rather than watching, for now.
///
/// The queue only changes when a log line lands, and a log is written
/// while it is read. Ten seconds is far below any threshold the ranking
/// uses, so nothing visible waits on it.
const EVERY_MS = 10_000;

type View =
  | { at: "cockpit" }
  | { at: "settings" }
  | { at: "review"; project: string }
  | { at: "files"; project: string };

export function App() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [view, setView] = useState<View>({ at: "cockpit" });

  const reload = async () => {
    try {
      setQueue(await invoke<Queue>("queue"));
      setFailed(null);
    } catch (e) {
      // Named rather than a blank screen: a product that cannot reach its
      // own core must not look like a product with nothing to show.
      setFailed(String(e));
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (alive) await reload();
    };
    void load();
    const t = setInterval(load, EVERY_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (failed) {
    return (
      <main className="app">
        <div className="unreachable">could not reach the core — {failed}</div>
      </main>
    );
  }
  if (!queue) return <main className="app" />;

  if (view.at === "settings") {
    return (
      <main className="app">
        <header className="head">
          <button type="button" className="back" onClick={() => setView({ at: "cockpit" })}>
            ← needs you
          </button>
          <h1>what the product was told</h1>
        </header>
        {/* Reloading the queue on every change is what makes registering a
            project feel like it did something: the empty screen changes
            from "nothing registered" to "watching 1". */}
        <SettingsScreen onChanged={() => void reload()} />
      </main>
    );
  }

  if (view.at !== "cockpit") {
    return (
      <main className="app wide">
        <header className="head">
          <button type="button" className="back" onClick={() => setView({ at: "cockpit" })}>
            ← needs you
          </button>
          <nav className="tabs">
            <button
              type="button"
              className={view.at === "review" ? "on" : ""}
              onClick={() => setView({ at: "review", project: view.project })}
            >
              what changed
            </button>
            <button
              type="button"
              className={view.at === "files" ? "on" : ""}
              onClick={() => setView({ at: "files", project: view.project })}
            >
              files
            </button>
          </nav>
        </header>
        {view.at === "review" ? (
          <ReviewScreen project={view.project} />
        ) : (
          <FilesScreen project={view.project} />
        )}
      </main>
    );
  }

  return (
    <main className="app">
      <header className="head">
        <h1>needs you</h1>
        <div className="head-right">
          <WipBar wip={queue.wip} />
          <button type="button" className="back" onClick={() => setView({ at: "settings" })}>
            settings
          </button>
        </div>
      </header>

      {queue.groups.length === 0 ? (
        <EmptyCockpit watching={queue.watching} onRegister={() => setView({ at: "settings" })} />
      ) : (
        queue.groups.map((g) => (
          <QueueGroup
            key={g.session}
            group={g}
            onReview={(project) => setView({ at: "review", project })}
          />
        ))
      )}

      {queue.unreachable.length > 0 ? (
        <div className="unreachable">
          could not read: {queue.unreachable.join(", ")}
        </div>
      ) : null}
    </main>
  );
}

export function ReviewScreen({ project }: { project: string }) {
  const [data, setData] = useState<ReviewView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = () => {
    loadReview(project).then(setData).catch((e) => setFailed(String(e)));
  };
  useEffect(load, [project]);

  if (failed) return <div className="unreachable">{failed}</div>;
  if (!data) return <p className="quiet">reading the tree…</p>;

  const seen = (f: FileDiff) => {
    markSeen(project, f.path, f.fingerprint);
    load();
  };

  return (
    <>
      <h2>what it said it would do</h2>
      <IntentPanel sessions={data.sessions} />

      <h2>
        what changed
        {data.unannounced.length > 0 ? (
          <span className="badge surprise">
            {data.unannounced.length} unannounced
          </span>
        ) : null}
      </h2>
      {data.unreachable ? (
        <p className="unreachable">{data.unreachable}</p>
      ) : (
        <DiffView diff={data.diff} unannounced={data.unannounced} onSeen={seen} />
      )}
    </>
  );
}

export function FilesScreen({ project }: { project: string }) {
  const [path, setPath] = useState<string | null>(null);
  return (
    <div className="explorer">
      <FileTree project={project} onOpen={setPath} selected={path} />
      <CodeView project={project} path={path} />
    </div>
  );
}

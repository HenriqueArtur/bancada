import { useEffect, useRef, useState } from "react";
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
import { ElsewhereBand } from "./components/elsewhere-band";
import { idsOf, newcomers, phrase, raise, waiting } from "./attention";

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
  /// Why the product cannot get your attention, when it cannot.
  const [mute, setMute] = useState<string | null>(null);

  /// What the last reading held, so the next one can tell what is new.
  ///
  /// A ref rather than state: it must not cause a render, and it must be
  /// current inside the interval closure — state read there would be the
  /// value from the render that created it, and every poll would announce
  /// the same items forever.
  const seen = useRef<Set<string> | null>(null);

  const reload = async () => {
    try {
      const q = await invoke<Queue>("queue");
      setQueue(q);
      setFailed(null);

      const fresh = newcomers(seen.current, q.groups);
      seen.current = idsOf(q.groups);
      // The badge every time, the notification only for what arrived. A
      // window you have to remember to open does not answer "I cannot keep
      // track of what is happening".
      // An operating system that will not take the message is not a reason
      // to lose the queue that was already read — but it is not a reason to
      // stay quiet either. A supervisor that silently stopped supervising
      // is worse than one that says it cannot.
      void raise(waiting(q), phrase(fresh)).then(
        () => setMute(null),
        (e) => setMute(String(e)),
      );
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
        <ElsewhereBand path={queue.elsewhere} />
        <header className="head">
          <div className="head-stack">
            <BackToQueue queue={queue} onBack={() => setView({ at: "cockpit" })} />
            <h1>what the product was told</h1>
          </div>
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
        <ElsewhereBand path={queue.elsewhere} />
        <header className="head">
          <div className="head-stack">
            <BackToQueue queue={queue} onBack={() => setView({ at: "cockpit" })} />
            {/* The project, named. Two screens deep into a diff, "which
                repository am I even looking at" is a real question. */}
            <h1>{view.project}</h1>
          </div>
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
      <ElsewhereBand path={queue.elsewhere} />
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

      {mute ? (
        <div className="unreachable">
          cannot reach you outside this window — {mute}
        </div>
      ) : null}

      {queue.unreachable.length > 0 ? (
        <div className="unreachable">
          could not read: {queue.unreachable.join(", ")}
        </div>
      ) : null}
    </main>
  );
}

/// The way back, carrying the count.
///
/// The queue lives on one screen and the product exists to say what needs
/// you — so every other screen has to keep saying how much is waiting, or
/// opening the file pane becomes a way to stop being told.
function BackToQueue({ queue, onBack }: { queue: Queue; onBack: () => void }) {
  const n = queue.wip.sessions_waiting;
  return (
    <button type="button" className="back" onClick={onBack}>
      ← needs you
      {n > 0 ? <span className="count-chip">{n}</span> : null}
    </button>
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

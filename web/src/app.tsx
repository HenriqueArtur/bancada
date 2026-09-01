import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Queue } from "./queue";
import { QueueGroup } from "./components/queue-group";
import { EmptyCockpit } from "./components/empty-cockpit";
import { WipBar } from "./components/wip-bar";

/// Polling rather than watching, for now.
///
/// The queue only changes when a log line lands, and a log is written
/// while it is read. Ten seconds is far below any threshold the ranking
/// uses, so nothing visible waits on it.
const EVERY_MS = 10_000;

export function App() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const q = await invoke<Queue>("queue");
        if (alive) {
          setQueue(q);
          setFailed(null);
        }
      } catch (e) {
        // Named rather than a blank screen: a product that cannot reach
        // its own core must not look like a product with nothing to show.
        if (alive) setFailed(String(e));
      }
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

  return (
    <main className="app">
      <header className="head">
        <h1>needs you</h1>
        <WipBar wip={queue.wip} />
      </header>

      {queue.groups.length === 0 ? (
        <EmptyCockpit watching={queue.watching} />
      ) : (
        queue.groups.map((g) => <QueueGroup key={g.session} group={g} />)
      )}

      {queue.unreachable.length > 0 ? (
        <div className="unreachable">
          could not read: {queue.unreachable.join(", ")}
        </div>
      ) : null}
    </main>
  );
}

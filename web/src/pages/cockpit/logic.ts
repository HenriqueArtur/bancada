import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Queue } from "@/core/queue";
import { idsOf, newcomers, phrase, raise, waiting } from "@/core/attention";

/// Polling rather than watching, for now.
///
/// The queue only changes when a log line lands, and a log is written while
/// it is read. Ten seconds is far below any threshold the ranking uses, so
/// nothing visible waits on it.
export const EVERY_MS = 10_000;

export interface Cockpit {
  queue: Queue | null;
  /// Why the core could not be reached, when it could not.
  failed: string | null;
  /// Why the product cannot get your attention, when it cannot.
  mute: string | null;
  reload: () => Promise<void>;
}

/// The queue, kept current, and the attention that goes with it.
///
/// Lives here rather than in the view so the poll, the diffing of newcomers
/// and the error handling can be read — and changed — without a DOM in the
/// way.
export function useCockpit(): Cockpit {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
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
      // The badge every time, the notification only for what arrived. An
      // operating system that will not take the message is not a reason to
      // lose the queue that was already read — but it is not a reason to
      // stay quiet either.
      await raise(waiting(q), phrase(fresh)).then(
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
    const tick = () => {
      if (alive) void reload();
    };
    tick();
    const t = setInterval(tick, EVERY_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { queue, failed, mute, reload };
}

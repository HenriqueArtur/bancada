import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Queue } from "@/core/queue";
import { idsOf, newcomers, phrase, raise, waiting } from "@/core/attention";
import { live } from "@/core/live";
import { useText } from "@/lib/language";

/// Told, not asked — see ADR-022.
///
/// The queue only changes when a log line lands, and the core watches for
/// exactly that. What remains here is the fallback: when it cannot watch,
/// the window goes back to asking, and says so rather than looking live.

export interface Cockpit {
  queue: Queue | null;
  /// Why the core could not be reached, when it could not.
  failed: string | null;
  /// Why the product cannot get your attention, when it cannot.
  mute: string | null;
  /// True while the window is asking on a timer because it could not be
  /// told. Named so a screen can say it: one that looks live while it is a
  /// minute behind lies with more confidence than one that admits it.
  asking: boolean;
  reload: () => Promise<void>;
}

/// The queue, kept current, and the attention that goes with it.
///
/// Lives here rather than in the view so the poll, the diffing of newcomers
/// and the error handling can be read — and changed — without a DOM in the
/// way.
export function useCockpit(): Cockpit {
  const t = useText();
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

  /// Stable except when the language changes, because the notification it
  /// raises is written in it. The interval below depends on this, so an
  /// unstable identity would tear down and restart the poll on every render.
  const reload = useCallback(async () => {
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
      await raise(waiting(q), phrase(fresh, t)).then(
        () => setMute(null),
        (e) => setMute(String(e)),
      );
    } catch (e) {
      // Named rather than a blank screen: a product that cannot reach its
      // own core must not look like a product with nothing to show.
      setFailed(String(e));
    }
  }, [t]);

  const [asking, setAsking] = useState(false);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) void reload();
    };
    tick();
    const channel = live(tick);
    void channel.asking.then((told) => alive && setAsking(!told));
    return () => {
      alive = false;
      channel.stop();
    };
  }, [reload]);

  return { queue, failed, mute, asking, reload };
}

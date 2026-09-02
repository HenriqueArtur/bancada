/// Being told, instead of asking.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/// The one event the core sends.
///
/// It carries nothing on purpose. A filesystem event says a line landed in
/// some log, which is not a fact any screen is shaped around — and a payload
/// naming a path would invite a screen to believe it knows which of its
/// questions went stale. Everything re-asks; the reads are cheap.
const CHANGED = "bancada:changed";

/// How often to ask when nobody is telling.
///
/// Slower than the ten seconds this replaced, deliberately: it is a safety
/// net rather than the mechanism, and a net costing as much as the thing it
/// replaced is not a net.
export const FALLBACK_MS = 60_000;

/// Whether the core is watching, or `null` while it has not decided yet.
export const watching = (): Promise<boolean | null> => invoke<boolean | null>("watching");

/// Run `then` whenever anything changes, and say how it is finding out.
///
/// Falls back to asking on a timer, and reports which mode it settled into
/// so a screen can say so. A window that looks live while it is a minute
/// behind lies with more confidence than one that admits it — the same
/// argument `RuntimeError::Unsupported` already makes about a watch that
/// reports nothing.
export function live(then: () => void): { stop: () => void; asking: Promise<boolean> } {
  let stopped = false;
  let drop: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const asking = (async () => {
    let told = false;
    try {
      told = (await watching()) === true;
      if (told) drop = await listen(CHANGED, () => then());
    } catch {
      // Not in a Tauri window, or the core never answered. Either way the
      // timer below is the honest thing to do.
      told = false;
    }
    // Checked after the awaits: the screen may have gone while this was in
    // flight, and a listener attached to a component that is no longer there
    // is a leak that fires forever.
    if (stopped) {
      drop?.();
      return told;
    }
    if (!told) timer = setInterval(then, FALLBACK_MS);
    return told;
  })();

  return {
    asking,
    stop: () => {
      stopped = true;
      drop?.();
      if (timer) clearInterval(timer);
    },
  };
}

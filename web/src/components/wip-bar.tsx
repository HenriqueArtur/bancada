import type { Wip } from "../queue";

/// How much of your attention is already spoken for.
///
/// Counts sessions waiting, not items: six agents working cost nothing,
/// five stalled on you mean you became the bottleneck.
///
/// Drawn as pips rather than written as a fraction. The number matters less
/// than the shape — you are meant to catch it in the corner of your eye and
/// keep reading, not stop and do arithmetic.
export function WipBar({ wip }: { wip: Wip }) {
  const over = wip.sessions_waiting > wip.limit;
  const pips = Math.max(wip.limit, wip.sessions_waiting);

  return (
    <span className={over ? "wip over" : "wip"}>
      <span className="pips" aria-hidden="true">
        {Array.from({ length: pips }, (_, i) => (
          <span key={i} className={i < wip.sessions_waiting ? "pip on" : "pip"} />
        ))}
      </span>
      <span>
        {wip.sessions_waiting === 0 ? "nobody waiting" : `${wip.sessions_waiting} waiting`}
        {/* Kept visible rather than tucked into a tooltip: two sessions
            holding nine decisions is a different afternoon from two holding
            two, and a tooltip is a thing nobody hovers. */}
        {wip.items > wip.sessions_waiting ? ` · ${wip.items} items` : ""}
        {over ? ` · past ${wip.limit}` : ""}
      </span>
    </span>
  );
}

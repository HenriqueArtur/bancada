import type { Wip } from "../queue";

/// How much of your attention is already spoken for.
///
/// Counts sessions waiting, not items: six agents working cost nothing,
/// five stalled on you mean you became the bottleneck.
export function WipBar({ wip }: { wip: Wip }) {
  const over = wip.sessions_waiting > wip.limit;
  return (
    <span className={over ? "wip over" : "wip"}>
      {wip.sessions_waiting} waiting
      {wip.items > wip.sessions_waiting ? ` · ${wip.items} items` : ""}
      {over ? ` · over ${wip.limit}` : ""}
    </span>
  );
}

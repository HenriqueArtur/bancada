import type { Ranked } from "../queue";

/// Why this item is where it is.
///
/// Per-project weights make the order opaque, and a queue you do not trust
/// is a queue you ignore — which sends you back to counting terminals. It
/// is off the screen until asked for, because the arithmetic already
/// exists and only needed showing.
export function ScoreBreakdown({ r }: { r: Ranked }) {
  const rows: [string, string][] = [
    ["kind", `×${r.kind_factor}`],
    ["age", `${Math.round(r.age_ms / 60_000)}min`],
    ["weight", `×${r.item.project_weight}`],
    ["blocking", `×${r.blocking_factor}`],
  ];
  return (
    <div className="breakdown">
      {rows.map(([k, v]) => (
        <div key={k}>
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      <div className="total">
        <span>score</span>
        <span>{r.score}</span>
      </div>
    </div>
  );
}

import type { Ranked } from "../queue";

/// Why this item is where it is.
///
/// Per-project weights make the order opaque, and a queue you do not trust
/// is a queue you ignore — which sends you back to counting terminals. It is
/// off the screen until asked for, because the arithmetic already exists and
/// only needed showing.
export function ScoreBreakdown({ r }: { r: Ranked }) {
  const rows: [string, string][] = [
    ["kind", `×${r.kind_factor}`],
    ["age", `${Math.round(r.age_ms / 60_000)}min`],
    ["weight", `×${r.item.project_weight}`],
    ["blocking", `×${r.blocking_factor}`],
  ];
  return (
    <div className="score">
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <dt className="total">score</dt>
        <dd className="total">{r.score.toLocaleString()}</dd>
      </dl>
    </div>
  );
}

import { useState } from "react";
import { age, label, type Grouped } from "../queue";
import { ScoreBreakdown } from "./score-breakdown";

/// One session's pending things, together.
///
/// Grouping is display. The order *between* groups comes from the best
/// item in each, so a session never floats up for having many trivial
/// things — and identical permissions collapse into one line, which is the
/// known defence against a queue nobody reads any more.
export function QueueGroup({ group }: { group: Grouped }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = collapse(group);

  return (
    <section className="group">
      <div className="session">{group.session}</div>
      {rows.map((row, i) => (
        <div key={row.key}>
          <button
            type="button"
            className="item"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="when">{age(row.first.age_ms)}</span>
            <span className="what">{label(row.first.item.kind)}</span>
            {row.count > 1 ? <span className="count">×{row.count}</span> : null}
          </button>
          {open === i ? <ScoreBreakdown r={row.first} /> : null}
        </div>
      ))}
    </section>
  );
}

interface Row {
  key: string;
  first: Grouped["items"][number];
  count: number;
}

/// Only trivia collapses. Two questions are two decisions, and folding
/// them would hide one behind the other — the thing a per-decision queue
/// exists to prevent.
function collapse(group: Grouped): Row[] {
  const out: Row[] = [];
  for (const r of group.items) {
    const last = out.at(-1);
    if (last && last.first.item.kind === r.item.kind && r.item.kind === "Permission") {
      last.count += 1;
    } else {
      out.push({ key: `${r.item.kind}-${r.item.raised_at}-${out.length}`, first: r, count: 1 });
    }
  }
  return out;
}

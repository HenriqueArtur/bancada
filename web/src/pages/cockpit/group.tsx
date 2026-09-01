import { useState } from "react";
import { age, label, type Grouped } from "@/core/queue";
import { Badge, Button, Card, Mono, RowButton, Text } from "@/components";
import { Row, Stack } from "@/frame";
import { Score } from "@/pages/cockpit/score";

/// One session's pending things, together.
///
/// Grouping is display. The order *between* groups comes from the best item
/// in each, so a session never floats up for having many trivial things —
/// and identical permissions collapse into one line, which is the known
/// defence against a queue nobody reads any more.
export function Group({
  group,
  onOpen,
}: {
  group: Grouped;
  onOpen?: (project: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = collapse(group);
  const project = group.items[0]?.item.project ?? "";

  return (
    <Card>
      <Row gap="snug" align="baseline" className="px-4 py-2.5 border-b border-line-soft">
        <Mono>{group.session}</Mono>
        {onOpen && project ? (
          <Button tone="link" size="sm" className="ml-auto" onClick={() => onOpen(project)}>
            Open {project}
          </Button>
        ) : null}
      </Row>

      {rows.map((row, i) => (
        <Stack gap="none" key={row.key}>
          <RowButton
            onClick={() => setOpen(open === i ? null : i)}
            className="items-baseline gap-3.5 rounded-none border-b border-line-soft px-4 py-3"
          >
            <Text as="span" size="sm" tone="muted" className="min-w-[58px] tabular-nums">
              {age(row.first.age_ms)}
            </Text>
            <Text as="span" size="lg">
              {label(row.first.item.kind)}
            </Text>
            {row.count > 1 ? <Badge className="ml-auto">×{row.count}</Badge> : null}
          </RowButton>
          {open === i ? <Score r={row.first} /> : null}
        </Stack>
      ))}
    </Card>
  );
}

interface Line {
  key: string;
  first: Grouped["items"][number];
  count: number;
}

/// Only trivia collapses. Two questions are two decisions, and folding them
/// would hide one behind the other — the thing a per-decision queue exists
/// to prevent.
export function collapse(group: Grouped): Line[] {
  const out: Line[] = [];
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

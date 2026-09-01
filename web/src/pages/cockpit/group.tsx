import { useState } from "react";
import { age, detail, label, type Glance, type Grouped } from "@/core/queue";
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
  glance,
  onOpen,
}: {
  group: Grouped;
  /// What this session is about. Absent is normal — a log the product could
  /// not read still has a queue row, and the row still works.
  glance?: Glance;
  onOpen?: (project: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = collapse(group);
  const project = group.items[0]?.item.project ?? "";

  return (
    <Card>
      <Stack gap="none" className="px-4 pt-2.5 pb-3 border-b border-line-soft">
        <Row gap="snug" align="baseline">
          {/* The project first, because it is what you triage by, and the
              short id after it, because with four terminals open it is the
              only thing that says which window to switch to. */}
          <Text as="span" size="sm" tone="muted">
            {project}
          </Text>
          <Mono tone="faint">{group.session.slice(0, 8)}</Mono>
          {onOpen && project ? (
            <Button tone="link" size="sm" className="ml-auto" onClick={() => onOpen(project)}>
              Open
            </Button>
          ) : null}
        </Row>
        {glance?.title ? (
          <Text size="lg" className="pt-0.5">
            {glance.title}
          </Text>
        ) : null}
      </Stack>

      {rows.map((row, i) => (
        <Stack gap="none" key={row.key}>
          <RowButton
            onClick={() => setOpen(open === i ? null : i)}
            className="items-baseline gap-3.5 rounded-none border-b border-line-soft px-4 py-3"
          >
            <Text as="span" size="sm" tone="muted" className="min-w-[58px] shrink-0 tabular-nums">
              {age(row.first.age_ms)}
            </Text>
            <Text as="span" size="sm" tone="clay" className="min-w-[92px] shrink-0">
              {label(row.first.item.kind)}
            </Text>
            {/* What the decision actually is. Without it every row has to be
                opened before you know whether it matters. */}
            <Text as="span" className="truncate">
              {detail(row.first, glance) ?? ""}
            </Text>
            {row.count > 1 ? (
              <Badge className="ml-auto shrink-0">×{row.count}</Badge>
            ) : null}
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

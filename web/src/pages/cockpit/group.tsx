import { useState } from "react";
import { BellSlashIcon } from "@phosphor-icons/react";
import { age, detail, label, type Glance, type Grouped } from "@/core/queue";
import { Badge, Button, Card, Mono, RowButton, Text } from "@/components";
import { Row, Stack } from "@/frame";
import { Score } from "@/pages/cockpit/score";
import { useText } from "@/lib/language";

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
  onMute,
}: {
  group: Grouped;
  /// What this session is about. Absent is normal — a log the product could
  /// not read still has a queue row, and the row still works.
  glance?: Glance;
  onOpen?: (project: string) => void;
  /// Silence the project this came from. Offered here because this is where
  /// you notice: the row in front of you is the moment you decide a project
  /// has stopped being yours to worry about, and making you go to another
  /// screen to say so is how it stays in the queue for another week.
  onMute?: (project: string) => void;
}) {
  const t = useText();
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
          <Row gap="tight" align="baseline" className="ml-auto shrink-0">
            {onMute && project ? (
              <Button
                tone="ghost"
                size="sm"
                onClick={() => onMute(project)}
                title={t("Stop {project} asking until there is new work in it", { project })}
              >
                <BellSlashIcon size={13} />
                {t("Silence")}
              </Button>
            ) : null}
            {onOpen && project ? (
              <Button tone="link" size="sm" onClick={() => onOpen(project)}>
                {t("Open")}
              </Button>
            ) : null}
          </Row>
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
            <Text
              as="span"
              size="sm"
              tone="muted"
              className="min-w-[58px] shrink-0 tabular-nums"
            >
              {age(row.first.age_ms, t)}
            </Text>
            <Text as="span" size="sm" tone="clay" className="min-w-[92px] shrink-0">
              {label(row.first.item.kind, t)}
            </Text>
            {/* What the decision actually is. Without it every row has to be
                opened before you know whether it matters. */}
            <Text as="span" className="truncate">
              {detail(row.first, t, glance) ?? ""}
            </Text>
            {row.count > 1 ? <Badge className="ml-auto shrink-0">×{row.count}</Badge> : null}
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

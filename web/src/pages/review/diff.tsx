// biome-ignore-all lint/suspicious/noArrayIndexKey: position *is* the identity here — these lists are rendered from one parse in source order and never reorder, which is the only thing the rule protects against

import { useState } from "react";
import type { Diff, FileDiff } from "@/core/review";
import { churn } from "@/core/review";
import { Badge, Button, Card, CodeBlock, Mono, RowButton, Text } from "@/components";
import { Stack } from "@/frame";
import { readingOrder } from "@/pages/review/logic";
import { cn } from "@/lib/cn";
import { useText } from "@/lib/language";

export function DiffView({
  diff,
  unannounced,
  onVouch,
}: {
  diff: Diff;
  /// Changed in the tree and announced by nobody. Shown first and marked,
  /// because in a long diff this is the short list worth reading.
  unannounced: string[];
  onVouch: (f: FileDiff) => void;
}) {
  const t = useText();
  if (diff.files.length === 0) {
    return (
      <Text tone="muted" size="sm">
        {t("The tree matches its last commit.")}
      </Text>
    );
  }
  const surprising = new Set(unannounced);
  return (
    <Stack gap="snug">
      {readingOrder(diff.files, unannounced).map((f) => (
        <FileBlock
          key={f.path}
          file={f}
          unannounced={surprising.has(f.path)}
          onVouch={onVouch}
        />
      ))}
    </Stack>
  );
}

function FileBlock({
  file,
  unannounced,
  onVouch,
}: {
  file: FileDiff;
  unannounced: boolean;
  onVouch: (f: FileDiff) => void;
}) {
  const t = useText();
  // A file already reviewed opens collapsed. Nothing is hidden — the header
  // still names it — but the pane opens on what moved.
  const [open, setOpen] = useState(file.fresh);

  return (
    <Card className={cn(file.fresh && "border-clay/40")}>
      <RowButton onClick={() => setOpen(!open)} className="gap-2.5 rounded-none px-4 py-2.5">
        <Mono tone="normal">{file.path}</Mono>
        {unannounced ? (
          <Badge tone="alarm" title={t("No session announced this file")}>
            {t("Unannounced")}
          </Badge>
        ) : null}
        {file.fresh ? <Badge tone="clay">{t("New to you")}</Badge> : null}
        <Text as="span" size="sm" tone="muted" className="ml-auto tabular-nums">
          {churn(file, t)}
        </Text>
        <Button
          tone="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onVouch(file);
          }}
        >
          {file.fresh ? t("Mark reviewed") : t("Reviewed")}
        </Button>
      </RowButton>

      {open
        ? file.hunks.map((h, i) => <CodeBlock key={i} header={h.header} lines={h.lines} />)
        : null}
    </Card>
  );
}

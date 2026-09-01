import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import { Badge, Button } from "@/components";

/// The way back, carrying the count.
///
/// The queue lives on one screen and the product exists to say what needs
/// you — so every other screen has to keep saying how much is waiting, or
/// opening the file pane becomes a way to stop being told.
export function BackToQueue({ queue, onBack }: { queue: Queue; onBack: () => void }) {
  const n = queue.wip.sessions_waiting;
  return (
    <Button tone="ghost" size="sm" onClick={onBack} className="-ml-2.5">
      <ArrowLeftIcon size={13} />
      Needs you
      {n > 0 ? <Badge tone="count">{n}</Badge> : null}
    </Button>
  );
}

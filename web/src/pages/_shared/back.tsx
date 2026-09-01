import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import { Badge, Button } from "@/components";
import { useText } from "@/lib/language";

/// Where a project screen was opened from.
export type Origin = "cockpit" | "work";

/// The way back to wherever you came from, carrying the count.
///
/// It used to always say "Needs you", which is right half the time and
/// stranding the other half: opening a project from the list and being sent
/// to the queue is the product deciding you were somewhere else.
///
/// The count rides along regardless. The queue lives on one screen and the
/// product exists to say what needs you, so every other screen keeps saying
/// how much is waiting — otherwise opening the file pane becomes a way to
/// stop being told.
export function BackToQueue({
  queue,
  from = "cockpit",
  onBack,
}: {
  queue: Queue;
  from?: Origin;
  onBack: () => void;
}) {
  const t = useText();
  const n = queue.wip.sessions_waiting;
  return (
    <Button tone="ghost" size="sm" onClick={onBack} className="-ml-2.5">
      <ArrowLeftIcon size={13} />
      {from === "work" ? t("Your work") : t("Needs you")}
      {n > 0 ? <Badge tone="count">{n}</Badge> : null}
    </Button>
  );
}

import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import { Badge, Button } from "@/components";
import { useText } from "@/lib/language";

/// The way back to the queue, carrying the count.
///
/// Always the queue. It used to lead back to whichever list you opened the
/// project from, which was a nicety worth less than the confusion of a
/// control that says something different depending on how you arrived — and
/// with a project switcher in the header, the list you came from is no
/// longer how you change project anyway.
///
/// The count rides along. The queue lives on one screen and the product
/// exists to say what needs you, so every other screen keeps saying how much
/// is waiting — otherwise opening the file pane becomes a way to stop being
/// told.
export function BackToQueue({ queue, onBack }: { queue: Queue; onBack: () => void }) {
  const t = useText();
  const n = queue.wip.sessions_waiting;
  return (
    <Button tone="ghost" size="sm" onClick={onBack} className="-ml-2.5">
      <ArrowLeftIcon size={13} />
      {t("Needs you")}
      {n > 0 ? <Badge tone="count">{n}</Badge> : null}
    </Button>
  );
}

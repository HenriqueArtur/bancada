import type { Wip } from "@/core/queue";
import { Pips, Text } from "@/components";
import { Row } from "@/frame";
import { cn } from "@/lib/cn";
import { useText } from "@/lib/language";

/// How much of your attention is already spoken for.
///
/// Counts sessions waiting, not items: six agents working cost nothing, five
/// stalled on you mean you became the bottleneck.
export function WipBar({ wip }: { wip: Wip }) {
  const t = useText();
  const over = wip.sessions_waiting > wip.limit;

  return (
    <Row gap="snug" className={cn(over ? "text-alarm" : "text-ink-muted")}>
      <Pips
        filled={wip.sessions_waiting}
        of={Math.max(wip.limit, wip.sessions_waiting)}
        tone={over ? "alarm" : "clay"}
      />
      <Text as="span" size="sm" className="text-inherit">
        {wip.sessions_waiting === 0
          ? t("Nobody waiting")
          : t("{n} waiting", { n: wip.sessions_waiting })}
        {/* Kept visible rather than tucked into a tooltip: two sessions
            holding nine decisions is a different afternoon from two holding
            two, and a tooltip is a thing nobody hovers. */}
        {wip.items > wip.sessions_waiting
          ? ` · ${t.plural(wip.items, "{n} item", "{n} items")}`
          : ""}
        {over ? ` · ${t("past {n}", { n: wip.limit })}` : ""}
      </Text>
    </Row>
  );
}

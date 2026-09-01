import type { Ranked } from "@/core/queue";
import { Facts, Text } from "@/components";
import { Inset, Stack } from "@/frame";
import { useText } from "@/lib/language";

/// Why this item is where it is.
///
/// Per-project weights make the order opaque, and a queue you do not trust
/// is a queue you ignore — which sends you back to counting terminals. Off
/// the screen until asked for: the arithmetic already exists and only
/// needed showing.
export function Score({ r }: { r: Ranked }) {
  const t = useText();
  return (
    <Inset pad="snug" className="bg-surface border-b border-line-soft">
      <Stack gap="snug">
        <Facts
          items={[
            { term: t("Kind"), value: `×${r.kind_factor}` },
            { term: t("Age"), value: t("{n} min", { n: Math.round(r.age_ms / 60_000) }) },
            { term: t("Weight"), value: `×${r.item.project_weight}` },
            { term: t("Blocking"), value: `×${r.blocking_factor}` },
            { term: t("Score"), value: r.score.toLocaleString(), strong: true },
          ]}
        />
        <Text size="xs" tone="faint">
          {t("Weight scales time. It never overrides the kind of decision.")}
        </Text>
      </Stack>
    </Inset>
  );
}

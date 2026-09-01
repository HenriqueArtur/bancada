import type { Ranked } from "@/core/queue";
import { Facts, Text } from "@/components";
import { Inset, Stack } from "@/frame";

/// Why this item is where it is.
///
/// Per-project weights make the order opaque, and a queue you do not trust
/// is a queue you ignore — which sends you back to counting terminals. Off
/// the screen until asked for: the arithmetic already exists and only
/// needed showing.
export function Score({ r }: { r: Ranked }) {
  return (
    <Inset pad="snug" className="bg-surface border-b border-line-soft">
      <Stack gap="snug">
        <Facts
          items={[
            { term: "Kind", value: `×${r.kind_factor}` },
            { term: "Age", value: `${Math.round(r.age_ms / 60_000)} min` },
            { term: "Weight", value: `×${r.item.project_weight}` },
            { term: "Blocking", value: `×${r.blocking_factor}` },
            { term: "Score", value: r.score.toLocaleString(), strong: true },
          ]}
        />
        <Text size="xs" tone="faint">
          Weight scales time. It never overrides the kind of decision.
        </Text>
      </Stack>
    </Inset>
  );
}

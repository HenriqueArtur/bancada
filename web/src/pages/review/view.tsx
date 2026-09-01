import { Badge, Text } from "@/components";
import { Banner, Section } from "@/composites";
import { Stack } from "@/frame";
import { useReview } from "@/pages/review/logic";
import { IntentPanel } from "@/pages/review/intent";
import { DiffView } from "@/pages/review/diff";

/// The diff, beside the claim it is supposed to honour.
export function ReviewPage({ project }: { project: string }) {
  const { data, failed, vouch } = useReview(project);

  if (failed) {
    return (
      <Banner label="Could not read" tone="alarm">
        <Text as="span" size="sm" tone="alarm">
          {failed}
        </Text>
      </Banner>
    );
  }
  if (!data) {
    return (
      <Text tone="muted" size="sm">
        Reading the tree…
      </Text>
    );
  }

  return (
    <Stack gap="loose">
      <Section title="What it said it would do">
        <IntentPanel sessions={data.sessions} />
      </Section>

      <Section
        title="What changed"
        aside={
          data.unannounced.length > 0 ? (
            <Badge tone="alarm">{data.unannounced.length} unannounced</Badge>
          ) : undefined
        }
      >
        {data.unreachable ? (
          <Banner label="Could not read the tree" tone="alarm">
            <Text as="span" size="sm" tone="alarm">
              {data.unreachable}
            </Text>
          </Banner>
        ) : (
          <DiffView diff={data.diff} unannounced={data.unannounced} onVouch={vouch} />
        )}
      </Section>
    </Stack>
  );
}

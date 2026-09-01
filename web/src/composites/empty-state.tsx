import type { ReactNode } from "react";
import { Heading, Text } from "@/components";
import { Stack } from "@/frame";

/// Nothing here, said properly.
///
/// An empty screen and a broken one look identical, so this always says
/// which it is — and only offers an action when there genuinely is one.
export function EmptyState({
  headline,
  detail,
  action,
}: {
  headline: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <Stack gap="snug" align="center" className="py-16 text-center">
      <Heading level={2} as="h3">
        {headline}
      </Heading>
      {detail ? (
        <Text tone="muted" size="sm">
          {detail}
        </Text>
      ) : null}
      {action}
    </Stack>
  );
}

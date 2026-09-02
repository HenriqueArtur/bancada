import type { ReactNode } from "react";
import { Heading, Mark, Text } from "@/components";
import { Stack } from "@/frame";

/// Nothing here, said properly.
///
/// An empty screen and a broken one look identical, so this always says
/// which it is — and only offers an action when there genuinely is one.
export function EmptyState({
  headline,
  detail,
  action,
  mark,
}: {
  headline: string;
  detail?: string;
  action?: ReactNode;
  /// The product's mark, set close enough to the page to be nearly not
  /// there. For the empty states that fill a pane rather than sit inside a
  /// list — the same argument the file viewer's empty pane already makes:
  /// a blank rectangle asks the reader to work out whether the product is
  /// broken or waiting.
  mark?: boolean;
}) {
  return (
    <Stack gap="snug" align="center" className="py-16 text-center">
      {mark ? <Mark size={96} className="mb-2 text-line" /> : null}
      <Heading level={2} as="h3">
        {headline}
      </Heading>
      {detail ? (
        <Text tone="muted" size="sm" className="max-w-[52ch]">
          {detail}
        </Text>
      ) : null}
      {action}
    </Stack>
  );
}

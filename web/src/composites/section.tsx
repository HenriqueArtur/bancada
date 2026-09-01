import type { ReactNode } from "react";
import { Heading } from "@/components";
import { Row, Stack } from "@/frame";

/// A titled region.
///
/// The title and its contents move together, so a section can never end up
/// with a heading three sections away from what it names.
export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap="snug">
      <Row gap="snug" align="baseline">
        <Heading level={2}>{title}</Heading>
        {aside}
      </Row>
      {children}
    </Stack>
  );
}

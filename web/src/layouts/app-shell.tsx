import type { ReactNode } from "react";
import { Heading } from "@/components";
import { Page, Row, Stack } from "@/frame";

/// Every screen's outer shape: a measured column, a title, a rule, content.
export function AppShell({
  title,
  above,
  aside,
  banner,
  children,
  wide,
}: {
  title: ReactNode;
  /// A way back, sitting over the title rather than beside it.
  above?: ReactNode;
  aside?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Page wide={wide}>
      <Stack gap="loose">
        {banner}
        <Row
          justify="between"
          align="end"
          gap="normal"
          className="border-b border-line-soft pb-4"
        >
          <Stack gap="none" align="start">
            {above}
            {typeof title === "string" ? (
              <Heading level={1} as="h1">
                {title}
              </Heading>
            ) : (
              title
            )}
          </Stack>
          {aside}
        </Row>
        {children}
      </Stack>
    </Page>
  );
}

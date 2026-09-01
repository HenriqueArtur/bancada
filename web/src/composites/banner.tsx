import type { ReactNode } from "react";
import { Text } from "@/components";
import { Row } from "@/frame";
import { cn } from "@/lib/cn";

/// A strip across the top of a screen that changes what the screen means.
///
/// Reserved for exactly that. A banner for anything less becomes furniture,
/// and furniture is invisible — which is fatal for the one message that has
/// to be read: that this is not your cockpit.
export function Banner({
  label,
  children,
  tone = "clay",
}: {
  label: string;
  children?: ReactNode;
  tone?: "clay" | "alarm";
}) {
  return (
    <Row
      gap="snug"
      wrap
      align="baseline"
      className={cn(
        "rounded-card border px-3.5 py-2",
        tone === "clay" ? "bg-clay-wash border-clay/25" : "bg-alarm-wash border-alarm/25",
      )}
    >
      <Text as="span" size="sm" tone={tone} className="font-semibold">
        {label}
      </Text>
      {children}
    </Row>
  );
}

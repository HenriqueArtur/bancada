import type { ReactNode } from "react";
import { WarningIcon, CheckCircleIcon, InfoIcon } from "@phosphor-icons/react";
import { Text } from "@/components";
import { Row } from "@/frame";
import { cn } from "@/lib/cn";

export type Tone = "found" | "empty" | "missing";

const SKIN = {
  found: { box: "bg-sage-wash text-sage", Icon: CheckCircleIcon },
  empty: { box: "bg-surface text-ink-muted", Icon: InfoIcon },
  missing: { box: "bg-alarm-wash text-alarm", Icon: WarningIcon },
} as const;

/// A short statement about the state of something, with its temperature.
///
/// Three tones and no more. A palette of severities is a palette nobody
/// learns, and the difference that matters here is only ever *good*,
/// *nothing yet*, and *wrong*.
export function Notice({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = SKIN[tone];
  return (
    <Row gap="snug" align="start" className={cn("rounded-lg px-3.5 py-2.5", box, className)}>
      <Icon size={15} weight="regular" className="mt-0.5 shrink-0" />
      <Text as="div" size="sm" className="text-inherit">
        {children}
      </Text>
    </Row>
  );
}

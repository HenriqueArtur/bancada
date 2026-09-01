import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const GAP = {
  none: "gap-0",
  tight: "gap-1.5",
  snug: "gap-3",
  normal: "gap-5",
  loose: "gap-8",
  airy: "gap-12",
} as const;

const ALIGN = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  baseline: "items-baseline",
  stretch: "items-stretch",
} as const;

const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

export type Gap = keyof typeof GAP;

interface Props {
  children: ReactNode;
  gap?: Gap;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
  grow?: boolean;
  className?: string;
}

/// Things in a column, evenly spaced.
///
/// The gaps are named rather than numeric on purpose. `gap-3` is a value
/// somebody chose once; `snug` is a decision the whole product can make the
/// same way, and six named steps are enough that nobody needs a seventh.
export function Stack({
  children,
  gap = "normal",
  align = "stretch",
  justify = "start",
  grow,
  className,
}: Props) {
  return (
    <div
      className={cn("flex flex-col", GAP[gap], ALIGN[align], JUSTIFY[justify], grow && "flex-1", className)}
    >
      {children}
    </div>
  );
}

/// The same, in a row.
export function Row({
  children,
  gap = "snug",
  align = "center",
  justify = "start",
  wrap,
  grow,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex",
        GAP[gap],
        ALIGN[align],
        JUSTIFY[justify],
        wrap && "flex-wrap",
        grow && "flex-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

/// Empty space that pushes what follows to the far edge.
export function Push() {
  return <div className="ml-auto" />;
}

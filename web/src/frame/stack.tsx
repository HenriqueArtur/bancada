import type { Ref, ReactNode } from "react";
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
  /// An anchor to scroll to, and a handle to watch.
  ///
  /// Here rather than in a page because a page may not render a `<div>` at
  /// all — the whole point of this layer. Two properties of the box, and
  /// neither of them says anything about what is in it.
  id?: string;
  ref?: Ref<HTMLDivElement>;
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
  id,
  ref,
}: Props) {
  return (
    <div
      id={id}
      ref={ref}
      className={cn(
        "flex flex-col",
        GAP[gap],
        ALIGN[align],
        JUSTIFY[justify],
        grow && "flex-1",
        className,
      )}
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

/// Takes whatever room is left, and may be narrower than its content.
///
/// `min-w-0` and `min-h-0` are the whole point: a flex child defaults to
/// `min-width: auto`, so one long line of code pushes the pane wider than
/// the window instead of scrolling inside it.
export function Fill({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 min-w-0 flex-1", className)}>{children}</div>;
}

/// Empty space that pushes what follows to the far edge.
export function Push() {
  return <div className="ml-auto" />;
}

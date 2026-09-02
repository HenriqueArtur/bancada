import type { ReactNode, Ref, UIEventHandler } from "react";
import { cn } from "@/lib/cn";

const PAD = {
  none: "p-0",
  tight: "p-2",
  snug: "px-4 py-3",
  normal: "px-5 py-4",
  loose: "px-6 py-5",
} as const;

/// Padding, from the same small set every time.
export function Inset({
  children,
  pad = "normal",
  className,
}: {
  children: ReactNode;
  pad?: keyof typeof PAD;
  className?: string;
}) {
  return <div className={cn(PAD[pad], className)}>{children}</div>;
}

/// A hairline between things.
export function Divider({ soft }: { soft?: boolean }) {
  return <hr className={cn("h-px w-full border-0", soft ? "bg-line-soft" : "bg-line")} />;
}

/// A region that scrolls on its own rather than growing the page.
export function Scroller({
  children,
  className,
  ref,
  onScroll,
}: {
  children: ReactNode;
  className?: string;
  /// A handle on the scrolling box, and a way to hear it move. Here rather
  /// than in a page because a page may not render a `<div>` at all — and
  /// both are properties of the box, not of what is in it.
  ref?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) {
  return (
    <div ref={ref} onScroll={onScroll} className={cn("min-h-0 overflow-auto", className)}>
      {children}
    </div>
  );
}

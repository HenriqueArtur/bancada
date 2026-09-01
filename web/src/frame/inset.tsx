import type { ReactNode } from "react";
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
export function Scroller({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 overflow-auto", className)}>{children}</div>;
}

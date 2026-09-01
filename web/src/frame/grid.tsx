import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const COLUMNS = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const;
const GAP = { snug: "gap-3", normal: "gap-x-5 gap-y-4", loose: "gap-x-6 gap-y-6" } as const;

/// Columns that collapse to one when there is no room.
///
/// Always collapsing, never a fixed track count: the window has a 520px
/// minimum and two columns of form fields at that width are two columns of
/// nothing.
export function Grid({
  children,
  columns = 2,
  gap = "normal",
  className,
}: {
  children: ReactNode;
  columns?: keyof typeof COLUMNS;
  gap?: keyof typeof GAP;
  className?: string;
}) {
  return <div className={cn("grid", COLUMNS[columns], GAP[gap], className)}>{children}</div>;
}

/// A child that takes the whole width of the grid it sits in.
export function Full({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sm:col-span-full", className)}>{children}</div>;
}

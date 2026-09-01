import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/// The document's one main region, at a measured width.
///
/// `wide` is for the panes that need the room — a diff, a file tree — and
/// nothing else. Prose keeps the narrow measure however wide the window
/// gets: a 1200px line is a line nobody's eye can return from.
export function Page({
  children,
  wide,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto px-7 pt-11 pb-24",
        wide ? "max-w-[1120px]" : "max-w-[720px]",
        className,
      )}
    >
      {children}
    </main>
  );
}

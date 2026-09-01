import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/// A narrow index beside a wide subject, each scrolling on its own.
///
/// A file tree that pushes the page down is a tree you have to scroll past
/// to reach the code it is indexing.
export function Split({
  index,
  subject,
  className,
}: {
  index: ReactNode;
  subject: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[250px_1fr] gap-6", className)}>
      <div className="min-h-0 overflow-auto border-r border-line-soft pr-3">{index}</div>
      <div className="min-h-0 overflow-auto">{subject}</div>
    </div>
  );
}

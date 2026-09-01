import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/// A whole row that is one click target.
///
/// Rows of a list, entries of a tree, sections of a sidebar. A `<div>` with
/// an `onClick` looks the same and is unreachable by keyboard, which is the
/// bug this exists to make impossible.
export function RowButton({
  className,
  selected,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left",
        "outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
        selected ? "bg-clay-wash text-clay" : "hover:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

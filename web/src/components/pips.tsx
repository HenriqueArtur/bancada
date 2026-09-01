// biome-ignore-all lint/suspicious/noArrayIndexKey: position *is* the identity here — these lists are rendered from one parse in source order and never reorder, which is the only thing the rule protects against

import { cn } from "@/lib/cn";

/// A small count, drawn rather than written.
///
/// Meant to be caught in the corner of an eye. The number belongs beside it
/// for when somebody actually looks; the pips are for when they do not.
export function Pips({
  filled,
  of,
  tone = "clay",
}: {
  filled: number;
  of: number;
  tone?: "clay" | "alarm";
}) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-[7px] rounded-full transition-colors",
            i < filled ? (tone === "alarm" ? "bg-alarm" : "bg-clay") : "bg-line",
          )}
        />
      ))}
    </span>
  );
}

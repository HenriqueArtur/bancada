import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] whitespace-nowrap",
  {
    variants: {
      // Every tone carries a border. A wash on a raised card is two warm
      // neutrals a few percent apart, which reads as a smudge rather than
      // as a badge — the outline is what makes it a thing with an edge.
      tone: {
        quiet: "bg-surface text-ink-muted border border-line",
        clay: "bg-clay-wash text-clay border border-clay/35",
        alarm: "bg-alarm-wash text-alarm border border-alarm/35",
        sage: "bg-sage-wash text-sage border border-sage/35",
        /// A count, carried on the thing it counts.
        count:
          "bg-clay text-clay-ink border border-clay font-semibold tabular-nums min-w-5 justify-center",
      },
    },
    defaultVariants: { tone: "quiet" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

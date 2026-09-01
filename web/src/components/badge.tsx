import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] whitespace-nowrap",
  {
    variants: {
      tone: {
        quiet: "bg-surface text-ink-muted border border-line",
        clay: "bg-clay-wash text-clay",
        alarm: "bg-alarm-wash text-alarm",
        sage: "bg-sage-wash text-sage",
        /// A count, carried on the thing it counts.
        count: "bg-clay text-clay-ink font-semibold tabular-nums min-w-5 justify-center",
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

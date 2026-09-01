import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg whitespace-nowrap font-medium " +
    "transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring " +
    "disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      // Clay means "this wants you", so only `primary` carries it, and a
      // screen with two of them has already lost the meaning.
      tone: {
        primary: "bg-clay text-clay-ink hover:brightness-110",
        outline: "border border-line bg-raised text-ink hover:border-clay",
        ghost: "text-ink-muted hover:bg-surface hover:text-ink",
        link: "text-clay underline underline-offset-2 hover:brightness-110",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-[15px]",
        icon: "size-8",
      },
    },
    defaultVariants: { tone: "outline", size: "md" },
  },
);

export function Button({
  className,
  tone,
  size,
  asChild,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof button> & { asChild?: boolean }) {
  const As = asChild ? Slot : "button";
  return <As className={cn(button({ tone, size }), className)} {...props} />;
}

export { button as buttonStyle };

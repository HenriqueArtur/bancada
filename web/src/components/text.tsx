import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/// A title, set in the serif.
///
/// Levels are visual weight, not document order — `level` picks the size and
/// `as` picks the tag, so a page can have one `<h1>` while three things look
/// like titles.
export function Heading({
  children,
  level = 2,
  as,
  className,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const As = as ?? (`h${level}` as const);
  const size = {
    1: "text-[27px] leading-tight tracking-[-0.015em]",
    2: "text-[19px] tracking-[-0.01em]",
    3: "text-[15px]",
  }[level];
  return <As className={cn("font-serif font-normal m-0", size, className)}>{children}</As>;
}

const TONE = {
  normal: "text-ink",
  muted: "text-ink-muted",
  faint: "text-ink-faint",
  clay: "text-clay",
  alarm: "text-alarm",
  sage: "text-sage",
} as const;

const SIZE = { xs: "text-[11.5px]", sm: "text-[13px]", md: "text-sm", lg: "text-[15px]" } as const;

export function Text({
  children,
  tone = "normal",
  size = "md",
  as = "p",
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  as?: "p" | "span" | "div";
  className?: string;
} & Omit<ComponentProps<"p">, "children" | "className">) {
  const As = as;
  return (
    <As className={cn("m-0", TONE[tone], SIZE[size], className)} {...rest}>
      {children}
    </As>
  );
}

/// A path, an id, a number that has to line up.
export function Mono({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <span className={cn("font-mono text-[12.5px] tabular-nums", TONE[tone], className)}>
      {children}
    </span>
  );
}

/// What an agent actually wrote, set as prose.
///
/// The serif is the argument of the review screen made typographically: a
/// claim you are being asked to hold a diff against is reading matter, not
/// interface text.
export function Quote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <blockquote
      className={cn(
        "m-0 font-serif text-[15.5px] leading-relaxed whitespace-pre-wrap",
        "max-h-[9em] overflow-auto",
        className,
      )}
    >
      {children}
    </blockquote>
  );
}

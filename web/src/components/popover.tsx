import * as Primitive from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/// A small panel anchored to the thing that opened it.
///
/// A floating layer rather than a section that unfolds in place: the panels
/// this holds sit beside lists, and one that pushed its list down every time
/// it opened would move the row you were about to click.
export function Popover({
  trigger,
  children,
  label,
  align = "start",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  /// What the panel is, for a screen reader that cannot see what it is
  /// anchored to.
  label: string;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          align={align}
          sideOffset={6}
          aria-label={label}
          collisionPadding={8}
          className={cn(
            "z-50 max-h-[min(28rem,var(--radix-popover-content-available-height))] overflow-y-auto",
            "rounded-xl border border-line bg-raised p-1.5 shadow-float",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            className,
          )}
        >
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

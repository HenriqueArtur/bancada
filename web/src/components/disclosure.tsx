import * as Primitive from "@radix-ui/react-collapsible";
import { CaretRightIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/// Something folded away until asked for.
///
/// Used for everything that has a sane default. The common case should not
/// look as hard as the rare one, and a form with every field open is a form
/// that reads as a questionnaire.
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Primitive.Root open={open} onOpenChange={setOpen} className={className}>
      <Primitive.Trigger
        className={cn(
          "flex items-center gap-1.5 rounded-md py-1 text-[13px] text-ink-muted",
          "outline-none transition-colors hover:text-ink",
          "focus-visible:ring-[3px] focus-visible:ring-ring",
        )}
      >
        <CaretRightIcon
          size={12}
          className={cn("transition-transform duration-150", open && "rotate-90")}
        />
        {summary}
      </Primitive.Trigger>
      <Primitive.Content className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <div className="pt-3">{children}</div>
      </Primitive.Content>
    </Primitive.Root>
  );
}

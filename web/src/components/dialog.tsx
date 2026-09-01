import * as Primitive from "@radix-ui/react-dialog";
import { XIcon } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/// A window over the page.
///
/// Radix rather than hand-rolled: the visible part of a modal is easy and
/// the rest is not — trapping focus, restoring it on close, marking the page
/// behind inert, escape, the scroll lock. Every one of those is invisible
/// until somebody uses a keyboard, and then all of them are missing at once.
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogFrame({
  children,
  title,
  description,
  className,
  ...props
}: ComponentProps<typeof Primitive.Content> & {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay
        className={cn(
          "fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        )}
      />
      <Primitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[min(880px,calc(100vw-48px))] h-[min(620px,calc(100vh-80px))]",
          "bg-ground border border-line rounded-[14px] shadow-float overflow-hidden",
          "flex outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {/* Named for screen readers even though the visible title lives in
            the panel: Radix warns without it, and the warning is right. */}
        <Primitive.Title className="sr-only">{title}</Primitive.Title>
        {description ? (
          <Primitive.Description className="sr-only">{description}</Primitive.Description>
        ) : null}
        {children}
        <Primitive.Close
          aria-label="Close"
          className={cn(
            "absolute right-3.5 top-3.5 grid size-7 place-items-center rounded-lg",
            "text-ink-faint hover:bg-surface hover:text-ink transition-colors outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring",
          )}
        >
          <XIcon size={15} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

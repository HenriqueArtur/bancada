import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/// A column at the width prose can be read at.
///
/// `wide` is for the panes that need the room — a diff, a file tree — and
/// nothing else. Prose keeps the narrow measure however wide the window
/// gets: a 1200px line is a line nobody's eye can return from.
///
/// Separate from [`Page`] because the shell inside a project is already the
/// document's one `main` landmark, and a second one nested in it is not a
/// second document. The two numbers live here so there is one of each.
export function Measure({
  children,
  wide,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full", wide ? "max-w-[1120px]" : "max-w-[720px]", className)}>
      {children}
    </div>
  );
}

/// The document's one main region, measured.
export function Page({
  children,
  wide,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <main className={cn("px-7 pt-11 pb-24", className)}>
      <Measure wide={wide}>{children}</Measure>
    </main>
  );
}

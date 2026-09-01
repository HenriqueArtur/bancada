import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/// The whole window, with nothing measured.
///
/// The counterpart of `Page`. Prose wants a narrow measure; a file tree
/// beside an editor wants every pixel, and a workbench that stops at 1120px
/// leaves the reading pane narrower than the terminal it is replacing.
///
/// Owns the viewport height so the panes inside can divide it: a workbench
/// whose height comes from its content cannot have two independently
/// scrolling halves.
export function Bleed({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("flex h-screen flex-col overflow-hidden", className)}>{children}</main>;
}

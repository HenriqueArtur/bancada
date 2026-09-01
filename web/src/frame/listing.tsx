import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/// A list that carries no bullets and no indent of its own.
export function Listing({
  children,
  indent,
  className,
}: {
  children: ReactNode;
  indent?: boolean;
  className?: string;
}) {
  return <ul className={cn("m-0 list-none", indent ? "pl-3" : "pl-0", className)}>{children}</ul>;
}

export function ListingItem({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

/// A named region of the page, for the reader and for the screen reader.
export function Region({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      {children}
    </nav>
  );
}

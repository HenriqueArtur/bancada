import { cn } from "@/lib/cn";

export interface Fact {
  term: string;
  value: string;
  strong?: boolean;
}

/// Terms and their values, lined up.
///
/// A description list rather than a table: these are labelled figures, not
/// rows of the same kind, and the difference is what a screen reader reads
/// out.
export function Facts({ items, className }: { items: Fact[]; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]", className)}>
      {items.map((f) => (
        <div key={f.term} className="contents">
          <dt className={cn(f.strong ? "font-semibold" : "text-ink-muted")}>{f.term}</dt>
          <dd className={cn("m-0 tabular-nums", f.strong && "font-semibold")}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

import { cn } from "@/lib/cn";

export type LineKind = "added" | "removed" | "context";

export interface CodeLine {
  kind: LineKind;
  text: string;
}

const MARK = { added: "+", removed: "−", context: " " } as const;

/// One hunk of a diff.
///
/// Additions and removals are washes rather than saturated bands: a hundred
/// changed lines should read as a hundred changed lines, not as an alarm.
export function CodeBlock({
  header,
  lines,
  className,
}: {
  header?: string;
  lines: CodeLine[];
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "m-0 overflow-x-auto border-t border-line-soft bg-surface py-1.5 font-mono text-xs",
        className,
      )}
    >
      {header ? <code className="block px-4 text-ink-faint">{header}</code> : null}
      {lines.map((l, i) => (
        <code
          key={i}
          className={cn(
            "block whitespace-pre px-4 leading-relaxed",
            l.kind === "added" && "bg-sage-wash",
            l.kind === "removed" && "bg-alarm-wash",
          )}
        >
          {MARK[l.kind]}
          {l.text}
        </code>
      ))}
    </pre>
  );
}

/// A whole file, unhighlighted. The fallback when Monaco will not load.
export function PlainText({ text }: { text: string }) {
  return (
    <pre className="m-0 h-full overflow-auto rounded-card border border-line bg-surface p-3.5 font-mono text-xs">
      {text}
    </pre>
  );
}

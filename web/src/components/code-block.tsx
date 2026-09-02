// biome-ignore-all lint/suspicious/noArrayIndexKey: position *is* the identity here — these lists are rendered from one parse in source order and never reorder, which is the only thing the rule protects against

import { cn } from "@/lib/cn";

export type LineKind = "added" | "removed" | "context";

export interface CodeSegment {
  text: string;
  changed: boolean;
}

export interface CodeLine {
  kind: LineKind;
  text: string;
  /// What differs inside the line, when a counterpart was close enough to
  /// say. `null` or absent renders the line whole.
  parts?: CodeSegment[] | null;
  /// Where the line sits on each side of the change. `null` on the side
  /// that does not have it: a removed line has no number in the new file.
  oldNo?: number | null;
  newNo?: number | null;
}

const MARK = { added: "+", removed: "−", context: " " } as const;

/// The number columns, drawn even when empty so the code starts in the same
/// place on every row.
///
/// `select-none` because a diff is something people copy, and a paste that
/// arrives with two columns of line numbers welded to it is a paste nobody
/// can compile.
function Gutter({ old: oldNo, now }: { old?: number | null; now?: number | null }) {
  return (
    <span className="sticky left-0 inline-block select-none bg-inherit pr-2.5 text-ink-faint">
      <span className="inline-block w-9 text-right tabular-nums">{oldNo ?? ""}</span>
      <span className="ml-1 inline-block w-9 text-right tabular-nums">{now ?? ""}</span>
    </span>
  );
}

/// One hunk of a diff.
///
/// Additions and removals are washes rather than saturated bands: a hundred
/// changed lines should read as a hundred changed lines, not as an alarm.
/// The marks *inside* a line are one step deeper than the wash they sit on,
/// which is the only way a second signal fits without becoming a third
/// colour.
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
      {/* Indented to where the code starts, not to the page: the header is
          a label for the lines under it, and hanging it out to the left of
          the gutter makes it look like a line of the file. */}
      {header ? (
        <code className="block px-4 text-ink-faint">
          <span className="inline-block w-[76px] select-none" />
          {header}
        </code>
      ) : null}
      {lines.map((l, i) => (
        <code
          key={i}
          className={cn(
            "block whitespace-pre px-4 leading-relaxed",
            l.kind === "added" && "bg-sage-wash",
            l.kind === "removed" && "bg-alarm-wash",
          )}
        >
          <Gutter old={l.oldNo} now={l.newNo} />
          {MARK[l.kind]}
          {l.parts
            ? l.parts.map((p, k) => (
                <span
                  key={k}
                  className={cn(
                    p.changed && l.kind === "added" && "rounded-[2px] bg-sage-mark",
                    p.changed && l.kind === "removed" && "rounded-[2px] bg-alarm-mark",
                  )}
                >
                  {p.text}
                </span>
              ))
            : l.text}
        </code>
      ))}
    </pre>
  );
}

/// The unchanged body between two hunks, offered rather than shown.
///
/// A row rather than a floating button: it stands where the missing lines
/// stand, so the space it occupies is the space it will fill. Disabled while
/// the file is being read, because a second click would fetch it twice.
export function CodeGap({
  label,
  onExpand,
  busy,
}: {
  label: string;
  onExpand: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      disabled={busy}
      className="block w-full border-t border-line-soft bg-raised px-4 py-1 text-left font-mono text-[11px] text-ink-faint hover:bg-surface hover:text-ink-muted disabled:hover:bg-raised"
    >
      <span className="inline-block w-[76px] select-none pr-2.5 text-center">⋯</span>
      {label}
    </button>
  );
}

/// A whole file, unhighlighted. The fallback when Monaco will not load.
export function PlainText({ text }: { text: string }) {
  return (
    <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words bg-surface p-3.5 font-mono text-xs">
      {text}
    </pre>
  );
}

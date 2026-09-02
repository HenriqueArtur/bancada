// biome-ignore-all lint/suspicious/noArrayIndexKey: position *is* the identity here — these lists come from one parse of one string in source order and never reorder, which is the only thing the rule protects against

import { cn } from "@/lib/cn";

/// What this can draw, declared here rather than imported.
///
/// `core/prose.ts` parses a message into the same shape, and the two agree
/// structurally without either importing the other. That is the point: a
/// component that reached into `core` would be a component that only works
/// in this product, and the rule against it is the one thing keeping the
/// alphabet reusable. Two definitions of four fields is the price.
export interface ProseSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type ProseBlock =
  | { kind: "para"; spans: ProseSpan[] }
  | { kind: "bullet"; items: ProseSpan[][] }
  | { kind: "quote"; spans: ProseSpan[] }
  | { kind: "code"; text: string };

/// A parsed message, set as reading matter.
///
/// The serif is the same argument the review screen makes typographically: a
/// message somebody wrote for a person to read is prose, not interface text.
export function Prose({ blocks, className }: { blocks: ProseBlock[]; className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-3 font-serif text-[15px] leading-relaxed", className)}
    >
      {blocks.map((b, i) => {
        if (b.kind === "code") {
          return (
            <pre
              key={i}
              className="m-0 overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed"
            >
              {b.text}
            </pre>
          );
        }
        if (b.kind === "bullet") {
          return (
            <ul key={i} className="m-0 list-disc pl-5">
              {b.items.map((item, k) => (
                <li key={k} className="mb-1">
                  <Marked spans={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "quote") {
          return (
            <blockquote key={i} className="m-0 border-line border-l-2 pl-3 text-ink-muted">
              <Marked spans={b.spans} />
            </blockquote>
          );
        }
        return (
          <p key={i} className="m-0">
            <Marked spans={b.spans} />
          </p>
        );
      })}
    </div>
  );
}

function Marked({ spans }: { spans: ProseSpan[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.code ? (
          // Monospace *and* a wash. A backtick in running serif is otherwise
          // just a slightly different shape, and the reader has to already
          // know it was code to notice.
          <code key={i} className="rounded bg-surface px-1 font-mono text-[0.85em]">
            {s.text}
          </code>
        ) : s.bold ? (
          <strong key={i} className="font-semibold">
            {s.text}
          </strong>
        ) : s.italic ? (
          <em key={i}>{s.text}</em>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

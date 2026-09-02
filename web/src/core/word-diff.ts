/// What changed *inside* a line, for the pairs where saying so helps.
///
/// A unified diff's unit is the line, and for a line that was rewritten end
/// to end that is the right unit. For the far more common case — a renamed
/// variable, a flipped comparison, one argument added — it is the wrong one:
/// the reader gets a hundred and twenty characters of red above a hundred
/// and twenty of green and has to find the six that differ by eye.
///
/// Nothing here is required for the diff to be correct. It is a second pass
/// over what git already decided, and every guard below chooses *no*
/// highlight over a wrong one — confetti across two unrelated lines is worse
/// than the plain wash, because it teaches you to stop looking.
import type { Line, LineKind } from "@/core/review";

export interface Segment {
  text: string;
  changed: boolean;
}

export interface Painted {
  kind: LineKind;
  text: string;
  /// Set only when this line was paired with a counterpart close enough
  /// that pointing inside it is an improvement. `null` means "render the
  /// whole line as the wash already says".
  parts: Segment[] | null;
}

/// Identifiers, runs of whitespace, and single punctuation characters.
///
/// Punctuation one at a time rather than in runs so `foo(a, b)` → `foo(a,
/// b)` marks the comma alone. Whitespace kept as tokens rather than dropped
/// so a change in indentation is visible instead of invisible.
const TOKEN = /[A-Za-z0-9_]+|\s+|[^A-Za-z0-9_\s]/g;

/// Tokens per side before the comparison is abandoned.
///
/// The alignment is quadratic. 240 × 240 is a table of fifty-seven thousand
/// small integers and runs in under a millisecond; a minified bundle on one
/// line is a hundred thousand tokens and would freeze the window. A line
/// that long has no readable intra-line answer anyway.
const MOST = 240;

/// How much of the longer line must survive unchanged for the pairing to be
/// believable, in characters.
///
/// Below this the two lines are not a rewrite of each other — git put them
/// next to each other because they are adjacent, not because they
/// correspond — and marking the scattered `(`, `,` and `self` they happen to
/// share produces noise shaped like signal.
const ENOUGH = 0.3;

/// Mark the differences inside every removed/added pair in a hunk.
///
/// Pairs positionally within each removal-then-addition run, which is how
/// git emits a rewrite: all the `-` lines, then all the `+` lines. Where the
/// two runs are different lengths only the overlap is paired — the surplus
/// is a line with nothing to compare against, and inventing a counterpart
/// for it is exactly the mistake `ENOUGH` exists to refuse.
export function paint(lines: readonly Line[]): Painted[] {
  const out: Painted[] = lines.map((l) => ({ kind: l.kind, text: l.text, parts: null }));

  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind !== "removed") {
      i += 1;
      continue;
    }
    const gone = i;
    while (i < lines.length && lines[i].kind === "removed") i += 1;
    const came = i;
    while (i < lines.length && lines[i].kind === "added") i += 1;

    for (let k = 0; k < Math.min(came - gone, i - came); k += 1) {
      const both = within(lines[gone + k].text, lines[came + k].text);
      if (!both) continue;
      out[gone + k].parts = both[0];
      out[came + k].parts = both[1];
    }
  }
  return out;
}

/// The two lines split into what they share and what they do not, or `null`
/// when the answer would not be worth showing.
export function within(before: string, after: string): [Segment[], Segment[]] | null {
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  if (a.length === 0 || b.length === 0) return null;
  if (a.length > MOST || b.length > MOST) return null;

  const { left, right, kept } = walk(a, b, align(a, b));

  // Measured against the lines with their indentation off, to match `kept`,
  // which does not count it either. Left in, a change twelve levels deep
  // would be judged mostly by its leading spaces on both sides of the
  // fraction and never clear the bar.
  const size = Math.max(before.trim().length, after.trim().length);
  if (kept / size < ENOUGH) return null;
  // Nothing differs by token, so the wash is already the whole story and a
  // highlight would draw a box around the entire line.
  if (!left.some((s) => s.changed) && !right.some((s) => s.changed)) return null;

  return [runs(left), runs(right)];
}

/// Read the alignment off the table, one token at a time.
///
/// `kept` counts characters rather than tokens, because that is what the
/// reader sees: two lines sharing forty punctuation marks and no words have
/// almost nothing in common, and a token count would call them a match.
///
/// Whitespace is aligned like everything else and counts for nothing.
/// Shared indentation is not evidence — `    pub lines: Vec<Line>,` and
/// `    pub old_start: usize,` are two different fields, and the four spaces
/// plus `pub` plus a colon were enough to carry them over the threshold and
/// paint a correspondence that is not there. Deep in a nested block the
/// indent alone can be most of the line.
function walk(
  a: readonly string[],
  b: readonly string[],
  table: Uint32Array,
): { left: Segment[]; right: Segment[]; kept: number } {
  const width = b.length + 1;
  const left: Segment[] = [];
  const right: Segment[] = [];
  let kept = 0;
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      if (a[i].trim() !== "") kept += a[i].length;
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      left.push({ text: a[i], changed: true });
      i += 1;
    } else {
      right.push({ text: b[j], changed: true });
      j += 1;
    }
  }
  while (i < a.length) left.push({ text: a[i++], changed: true });
  while (j < b.length) right.push({ text: b[j++], changed: true });

  return { left, right, kept };
}

/// `table[i * width + j]` is the longest common subsequence of `a[i..]` and
/// `b[j..]`, filled from the end so the walk above can go forwards.
///
/// Forwards matters: a backwards walk emits the segments in reverse and the
/// reversal is one more place to get the order of two adjacent tokens wrong,
/// which reads as the highlight being off by one word.
function align(a: readonly string[], b: readonly string[]): Uint32Array {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  return table;
}

/// Adjacent tokens that agree become one segment.
///
/// Per token, `foo.bar()` renamed to `foo.baz()` would paint three separate
/// marks with gaps between them; joined, it paints one.
function runs(parts: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.changed === p.changed) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

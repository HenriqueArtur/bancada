/// A commit message, read as the prose it is.
///
/// Rendered raw, a commit body comes out wrong in two ways at once. Its lines
/// are hard-wrapped at seventy-two columns, so preserving them puts a ragged
/// edge down the middle of a wide pane; collapsing them instead runs every
/// paragraph into one block. And the `**` and the backticks people write stay
/// on screen as punctuation.
///
/// A parser rather than a library. Four constructs is what a commit message
/// uses, and a markdown dependency would bring a hundred — with a parser
/// whose failure modes nobody here has read.
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type Block =
  | { kind: "para"; spans: Span[] }
  | { kind: "bullet"; items: Span[][] }
  | { kind: "quote"; spans: Span[] }
  /// A fenced block, kept exactly as written. Wrapping code is how a command
  /// somebody meant to copy stops being one.
  | { kind: "code"; text: string };

/// Split a message into blocks, unwrapping the hard wrap inside each.
///
/// Each reader takes the lines and the cursor and hands back the block it
/// found and where it stopped. Written that way rather than as one loop with
/// four bodies, because "where it stopped" is the only thing they share and
/// getting it wrong loops forever.
export function prose(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }
    const read = fenced(lines, i) ?? bulleted(lines, i) ?? quoted(lines, i) ?? plain(lines, i);
    out.push(read[0]);
    i = read[1];
  }
  return out;
}

type Read = [Block, number];

function fenced(lines: string[], from: number): Read | null {
  if (!lines[from].trimStart().startsWith("```")) return null;
  const body: string[] = [];
  let i = from + 1;
  while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
    body.push(lines[i]);
    i += 1;
  }
  // Trailing blank lines come off. An unclosed fence otherwise keeps the
  // empty string that splitting a trailing newline leaves behind, and the
  // block renders one line taller than the code in it.
  while (body.length > 0 && body[body.length - 1].trim() === "") body.pop();
  // Past the closing fence, or past the end of the message.
  return [{ kind: "code", text: body.join("\n") }, i + 1];
}

function bulleted(lines: string[], from: number): Read | null {
  if (!BULLET.test(lines[from])) return null;
  const items: Span[][] = [];
  let i = from;
  while (i < lines.length && BULLET.test(lines[i])) {
    const said = [lines[i].replace(BULLET, "")];
    i += 1;
    // A continuation is an indented line starting no new bullet: the
    // seventy-two column wrap again, one level in.
    while (i < lines.length && /^\s+\S/.test(lines[i]) && !BULLET.test(lines[i])) {
      said.push(lines[i].trim());
      i += 1;
    }
    items.push(marks(said.join(" ")));
  }
  return [{ kind: "bullet", items }, i];
}

function quoted(lines: string[], from: number): Read | null {
  if (!lines[from].trimStart().startsWith("> ")) return null;
  const said: string[] = [];
  let i = from;
  while (i < lines.length && lines[i].trimStart().startsWith(">")) {
    said.push(lines[i].trimStart().replace(/^>\s?/, ""));
    i += 1;
  }
  return [{ kind: "quote", spans: marks(said.join(" ")) }, i];
}

function plain(lines: string[], from: number): Read {
  const said: string[] = [];
  let i = from;
  while (i < lines.length && lines[i].trim() !== "" && !special(lines[i])) {
    said.push(lines[i].trim());
    i += 1;
  }
  return [{ kind: "para", spans: marks(said.join(" ")) }, i];
}

const BULLET = /^\s*[-*+]\s+/;

function special(line: string): boolean {
  const at = line.trimStart();
  return BULLET.test(line) || at.startsWith("```") || at.startsWith("> ");
}

/// `**bold**`, `` `code` `` and `*italic*`, in one pass.
///
/// Code first and greedily, because what is inside a backtick is not marked
/// up — `**ptr` in a C snippet is a pointer, and a parser that saw bold there
/// would eat the rest of the sentence looking for the closing pair.
const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;

export function marks(text: string): Span[] {
  const out: Span[] = [];
  let at = 0;

  for (const m of text.matchAll(TOKEN)) {
    const start = m.index;
    if (start > at) out.push({ text: text.slice(at, start) });
    const [whole, code, bold, star, under] = m;
    if (code) out.push({ text: code.slice(1, -1), code: true });
    else if (bold) out.push({ text: bold.slice(2, -2), bold: true });
    else if (star) out.push({ text: star.slice(1, -1), italic: true });
    else if (under) out.push({ text: under.slice(1, -1), italic: true });
    at = start + whole.length;
  }

  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

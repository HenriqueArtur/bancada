/// The editor, painted in the same earth as the rest of the page.
///
/// Monaco's stock themes are cold — `vs` is clinical and `vs-dark` is
/// blue-black — and a panel that does not belong to the page around it reads
/// as a different program embedded in this one.
///
/// **`inherit` is false, and that is the whole point.** With it on, every
/// token family the rules do not name keeps the stock colour: `#af00db`
/// purple, `#dd0000` red, `#569cd6` blue, sitting beside clay and sage. Half
/// a palette is worse than none, because it reads as a bug rather than as a
/// choice. Off, anything unnamed falls back to `editor.foreground`, which is
/// the page's own ink — coherent by construction rather than by vigilance.
interface Palette {
  base: "vs" | "vs-dark";
  bg: string;
  fg: string;
  faint: string;
  line: string;
  comment: string;
  string: string;
  keyword: string;
  literal: string;
  type: string;
  alarm: string;
}

const PAPER: Palette = {
  base: "vs",
  bg: "#faf9f5",
  fg: "#1d1c1a",
  faint: "#b8b2a5",
  line: "#e6e1d6",
  comment: "#8a8478",
  string: "#4f6b42",
  keyword: "#a4593a",
  literal: "#7a6a3f",
  type: "#3d5a66",
  alarm: "#b03f26",
};

const LAMPLIGHT: Palette = {
  base: "vs-dark",
  bg: "#21201d",
  fg: "#ece8df",
  faint: "#5e594f",
  line: "#3d3a34",
  comment: "#7a7368",
  string: "#9dbb87",
  keyword: "#dd8560",
  literal: "#c9b280",
  type: "#8fb0bd",
  alarm: "#e0714f",
};

export const THEME = "bancada";

export function paletteFor(dark: boolean): Palette {
  return dark ? LAMPLIGHT : PAPER;
}

/// Every token family the bundled grammars actually emit.
///
/// Enumerated rather than inherited. Four hues do the work — a comment, a
/// string, a keyword, a literal — and a fifth for types. Everything else,
/// identifiers and delimiters and operators included, is the page's ink:
/// syntax colour in a read-only pane exists to help you find the shape of
/// the code, not to decorate every token in it.
function rulesFor(p: Palette) {
  const say = (tokens: string[], foreground: string, fontStyle?: string) =>
    tokens.map((token) =>
      fontStyle ? { token, foreground, fontStyle } : { token, foreground },
    );

  return [
    ...say(["comment", "comment.doc", "comment.content"], p.comment, "italic"),
    ...say(
      [
        "string",
        "string.quote",
        "string.escape",
        "string.key",
        "string.value",
        "regexp",
        "attribute.value",
      ],
      p.string,
    ),
    ...say(
      [
        "keyword",
        "keyword.type",
        "keyword.operator",
        "keyword.control",
        "keyword.other",
        "tag",
        "metatag",
        "annotation",
        "attribute.name",
        "key",
      ],
      p.keyword,
    ),
    ...say(
      ["number", "constant", "variable.predefined", "number.hex", "number.float"],
      p.literal,
    ),
    ...say(["type", "type.identifier", "namespace", "predefined", "entity.name.type"], p.type),
    ...say(["invalid", "string.escape.invalid", "string.invalid"], p.alarm),
    // Named so they are deliberately *not* coloured, rather than merely
    // forgotten: colouring punctuation is how a file starts looking busy.
    ...say(
      [
        "delimiter",
        "delimiter.bracket",
        "delimiter.parenthesis",
        "delimiter.square",
        "delimiter.angle",
        "operator",
        "identifier",
        "variable",
      ],
      p.fg,
    ),
  ];
}

export function definition(p: Palette) {
  return {
    base: p.base,
    inherit: false,
    rules: rulesFor(p),
    colors: {
      "editor.background": p.bg,
      "editor.foreground": p.fg,
      "editorLineNumber.foreground": p.faint,
      "editorLineNumber.activeForeground": p.comment,
      "editorCursor.foreground": p.keyword,
      "editor.selectionBackground": p.line,
      "editor.inactiveSelectionBackground": p.line,
      "editor.lineHighlightBackground": p.bg,
      "editorIndentGuide.background1": p.line,
      "editorIndentGuide.activeBackground1": p.faint,
      "editorWhitespace.foreground": p.line,
      "editorBracketMatch.background": p.bg,
      "editorBracketMatch.border": p.faint,
      "editorGutter.background": p.bg,
      "editorWidget.background": p.bg,
      "editorWidget.border": p.line,
      // Bracket pair colorization ships its own primaries — `#0431fa`,
      // `#319331` — and the editor option that turns it off is ignored in
      // this version. Painting the six levels in the page's ink is the
      // theme-level answer, and a palette decision belongs in the theme
      // anyway rather than in a flag that a version bump can stop honouring.
      "editorBracketHighlight.foreground1": p.fg,
      "editorBracketHighlight.foreground2": p.fg,
      "editorBracketHighlight.foreground3": p.fg,
      "editorBracketHighlight.foreground4": p.fg,
      "editorBracketHighlight.foreground5": p.fg,
      "editorBracketHighlight.foreground6": p.fg,
      "editorBracketHighlight.unexpectedBracket.foreground": p.alarm,
      "scrollbarSlider.background": `${p.line}cc`,
      "scrollbarSlider.hoverBackground": p.faint,
      "scrollbarSlider.activeBackground": p.faint,
    },
  };
}

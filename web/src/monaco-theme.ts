/// The editor, painted in the same earth as the rest of the page.
///
/// Monaco's stock themes are cold — `vs-dark` is blue-black and `vs` is
/// clinical white — and a panel that does not belong to the page around it
/// reads as a different program embedded in this one.
///
/// The rules are deliberately few. Syntax colour in a read-only pane exists
/// to help you find the shape of the code, not to decorate it, so this
/// spends three hues and leaves everything else in the text colour.
interface Palette {
  base: "vs" | "vs-dark";
  bg: string;
  fg: string;
  faint: string;
  comment: string;
  string: string;
  keyword: string;
  literal: string;
  type: string;
}

const PAPER: Palette = {
  base: "vs",
  bg: "#faf9f5",
  fg: "#1d1c1a",
  faint: "#e6e1d6",
  comment: "#8a8478",
  string: "#5d7a4f",
  keyword: "#a4593a",
  literal: "#7a6a3f",
  type: "#4a6670",
};

const LAMPLIGHT: Palette = {
  base: "vs-dark",
  bg: "#21201d",
  fg: "#ece8df",
  faint: "#3d3a34",
  comment: "#7a7368",
  string: "#9dbb87",
  keyword: "#dd8560",
  literal: "#c9b280",
  type: "#8fb0bd",
};

export const THEME = "bancada";

export function paletteFor(dark: boolean): Palette {
  return dark ? LAMPLIGHT : PAPER;
}

/// Monaco's theme definition for one palette.
///
/// Exported separately from the call that installs it so it can be read in
/// a test without a DOM: the thing worth checking is that both palettes
/// define the same rules, since a token coloured in one theme and left
/// default in the other is invisible in exactly one of them.
export function definition(p: Palette) {
  return {
    base: p.base,
    inherit: true,
    rules: [
      { token: "comment", foreground: p.comment, fontStyle: "italic" },
      { token: "string", foreground: p.string },
      { token: "keyword", foreground: p.keyword },
      { token: "number", foreground: p.literal },
      { token: "type", foreground: p.type },
      { token: "type.identifier", foreground: p.type },
    ],
    colors: {
      "editor.background": p.bg,
      "editor.foreground": p.fg,
      "editorLineNumber.foreground": p.faint,
      "editorLineNumber.activeForeground": p.comment,
      "editor.selectionBackground": p.faint,
      "editor.lineHighlightBackground": p.bg,
      "editorIndentGuide.background1": p.faint,
      "editorGutter.background": p.bg,
      "editorWidget.background": p.bg,
      "scrollbarSlider.background": `${p.faint}99`,
    },
  };
}

/// True when the viewer is reading in the dark.
export function prefersDark(): boolean {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return true;
  if (forced === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadFile } from "@/core/review";
import { THEME, definition, paletteFor } from "@/core/monaco-theme";
import { PlainText, Text } from "@/components";
import { Inset, Mount } from "@/frame";
import { useText } from "@/lib/language";

/// Whether the document is currently in the dark.
///
/// Watches the class rather than taking a prop through three components.
/// `appearance` says there is one writer and everything else reads the
/// class; an editor that had to be *told* would be a second reading, which
/// is the exact shape of the bug that once put a dark editor on a light
/// page.
export function useDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const root = document.documentElement;
    const watch = new MutationObserver(() => setDark(root.classList.contains("dark")));
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, []);

  return dark;
}

/// A file, read-only.
///
/// Monaco is loaded lazily and its failure is a fallback, not a blank pane:
/// syntax colour is a nicety, and a viewer that shows nothing when the
/// nicety fails to load is worse than a plain one.
///
/// `editor.main` rather than the bare package name: it is the entry that
/// carries the basic-language grammars, which is the whole reason to load
/// Monaco at all here. The language *services* are left out — they would
/// multiply the download to power completions a read-only pane can never
/// accept.
export function CodeView({ project, path }: { project: string; path: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const t = useText();
  const [plain, setPlain] = useState(false);
  const dark = useDark();

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setText(null);
    setFailed(null);
    loadFile(project, path)
      .then((t) => alive && setText(t))
      .catch((e) => alive && setFailed(String(e)));
    return () => {
      alive = false;
    };
  }, [project, path]);

  useEffect(() => {
    if (text === null || !host.current || !path) return;
    let editor: { dispose: () => void } | null = null;
    let alive = true;

    import("monaco-editor/esm/vs/editor/editor.main")
      .then((monaco) => {
        if (!alive || !host.current) return;
        host.current.innerHTML = "";
        monaco.editor.defineTheme(THEME, definition(paletteFor(dark)));
        editor = monaco.editor.create(host.current, {
          value: text,
          language: languageOf(path),
          readOnly: true,
          theme: THEME,
          fontSize: 13,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          // Wrapped, and indented where it wraps. This is a reading pane,
          // not an editing one: a line that runs off the right edge is a
          // line you did not review, and a licence file is four paragraphs
          // of six hundred characters each.
          wordWrap: "on",
          wrappingIndent: "indent",
          // Rainbow brackets are a separate feature from the token rules, and
          // they ship their own primaries. Punctuation is deliberately not
          // coloured here — colouring it is how a file starts looking busy.
          bracketPairColorization: { enabled: false },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          // Monaco draws its own, so it needs telling twice.
          scrollbar: {
            verticalScrollbarSize: 11,
            horizontalScrollbarSize: 11,
            useShadows: false,
          },
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
        });
      })
      .catch(() => alive && setPlain(true));

    return () => {
      alive = false;
      editor?.dispose();
    };
    // `dark` is a dependency, so changing the palette rebuilds the editor.
    // Cheaper would be `setTheme` on the live instance, and it would need a
    // handle to the module kept in a ref for the sake of an action nobody
    // performs twice a day.
  }, [text, path, dark]);

  if (!path) return <Aside>{t("Pick a file.")}</Aside>;
  if (failed) return <Aside tone="alarm">{failed}</Aside>;
  if (text === null) return <Aside>{t("Reading…")}</Aside>;
  if (plain) return <PlainText text={text} />;
  // No border and no radius: the pane *is* the editor, and a card around
  // it would be a frame around a window.
  return <Mount ref={host} />;
}

/// A one-line state, set in from the edge like the text would be.
function Aside({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "alarm";
}) {
  return (
    <Inset pad="normal">
      <Text tone={tone} size="sm">
        {children}
      </Text>
    </Inset>
  );
}

const BY_EXT: Record<string, string> = {
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  toml: "ini",
  yml: "yaml",
  yaml: "yaml",
  css: "css",
  html: "html",
  sh: "shell",
  py: "python",
  lua: "lua",
};

/// Deliberately a table, not a guess: an extension nobody listed reads as
/// plain text rather than being coloured as something it is not.
export function languageOf(path: string): string {
  const ext = path.split(".").pop() ?? "";
  return BY_EXT[ext] ?? "plaintext";
}

import { useEffect, useRef, useState } from "react";
import { loadFile } from "@/core/review";
import { THEME, definition, paletteFor, prefersDark } from "@/core/monaco-theme";
import { PlainText, Text } from "@/components";
import { Mount } from "@/frame";

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
  const [plain, setPlain] = useState(false);

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
        monaco.editor.defineTheme(THEME, definition(paletteFor(prefersDark())));
        editor = monaco.editor.create(host.current, {
          value: text,
          language: languageOf(path),
          readOnly: true,
          theme: THEME,
          fontSize: 12.5,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
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
  }, [text, path]);

  if (!path) {
    return (
      <Text tone="muted" size="sm">
        Pick a file.
      </Text>
    );
  }
  if (failed) {
    return (
      <Text tone="alarm" size="sm">
        {failed}
      </Text>
    );
  }
  if (text === null) {
    return (
      <Text tone="muted" size="sm">
        Reading…
      </Text>
    );
  }
  if (plain) return <PlainText text={text} />;
  return (
    <Mount ref={host} className="min-h-[340px] overflow-hidden rounded-card border border-line" />
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

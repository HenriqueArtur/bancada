/// A page for looking at a component without the shell around it.
///
/// The product is a desktop window, and there is no way to screenshot one
/// from a terminal. This is served by the dev server and rendered by headless
/// Chrome, which needs no permissions and produces the same picture every
/// time:
///
/// ```sh
/// bun run --cwd web dev --port 5199 &
/// tools/look.sh probe.png "?light"
/// ```
///
/// It has already earned itself twice: the editor's palette was leaking
/// Monaco's stock primaries, and no amount of reading the code showed it.
import "../src/theme.css";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { THEME, definition, paletteFor, prefersDark } from "../src/core/monaco-theme";
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

const SAMPLE = `use std::path::Path;

/// The queue for one project, from its facts.
#[derive(Debug, Clone)]
pub struct SessionState {
    pub session: SessionId,
    awaiting_human: bool,
}

impl SessionState {
    pub fn queue(states: &[Self], now: Timestamp, idle_after_ms: i64) -> Vec<QueueItem> {
        let mut out = Vec::new();
        for s in states {
            if s.awaiting_human && now.elapsed_to(s.last) > idle_after_ms {
                out.push(QueueItem::new(s.session.clone(), DecisionKind::Review, s.last));
            }
        }
        out // 42 items, "at most"
    }
}
`;

const monaco = await import("monaco-editor/esm/vs/editor/editor.main");
const dark = location.search.includes("dark") ? true : location.search.includes("light") ? false : prefersDark();
document.documentElement.classList.toggle("dark", dark);
monaco.editor.defineTheme(THEME, definition(paletteFor(dark)));
monaco.editor.create(document.getElementById("pane")!, {
  value: SAMPLE,
  language: "rust",
  readOnly: true,
  theme: THEME,
  fontSize: 13,
  lineHeight: 20,
  padding: { top: 12, bottom: 12 },
  bracketPairColorization: { enabled: false },
  renderLineHighlight: "none",
  overviewRulerLanes: 0,
  minimap: { enabled: false },
  automaticLayout: true,
  scrollBeyondLastLine: false,
});

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { App } from "./app";
import "./theme.css";

// Only the base editor worker. The language services (`ts.worker` and
// friends) would multiply the bundle to power completions that a read-only
// pane can never accept — syntax colour is all this viewer needs.
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

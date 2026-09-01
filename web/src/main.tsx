import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { apply, resolve, stored, systemIsDark } from "@/core/appearance";
import { App } from "./app";
import "./theme.css";

// Only the base editor worker. The language services (`ts.worker` and
// friends) would multiply the bundle to power completions that a read-only
// pane can never accept — syntax colour is all this viewer needs.
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

// Applied before the first paint, or the window opens in the wrong palette
// and corrects itself a frame later — which reads as a flash of the theme
// nobody chose.
apply(resolve(stored(), systemIsDark()));

// And kept in step: `system` means *keeps following*, not "was following
// when the window opened".
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => apply(resolve(stored(), e.matches)));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { App } from "./app";
import "./theme.css";

// Only the base editor worker. The language services (`ts.worker` and
// friends) would multiply the bundle to power completions that a read-only
// pane can never accept — syntax colour is all this viewer needs.
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

// Tailwind's dark variant keys off a class, and the product has no theme
// toggle yet — so the class follows the system, and keeps following it.
const night = window.matchMedia("(prefers-color-scheme: dark)");
const follow = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
follow(night.matches);
night.addEventListener("change", (e) => follow(e.matches));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

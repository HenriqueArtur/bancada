import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri serves the built assets from disk; a relative base keeps the
  // same build working in a browser and inside the shell.
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "jsdom", globals: true },
});

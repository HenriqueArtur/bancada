import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri serves the built assets from disk; a relative base keeps the
  // same build working in a browser and inside the shell.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Monaco is ~3.3 MB and lands in its own chunk, fetched only when a
    // file is opened — the cockpit screen stays around 200 kB. The warning
    // is right about the number and wrong about the consequence, and a
    // warning that fires on every build is one people stop reading.
    chunkSizeWarningLimit: 4000,
  },
  test: { environment: "jsdom", globals: true },
});

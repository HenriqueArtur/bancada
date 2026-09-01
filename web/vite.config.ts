import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    // `@/` is what shadcn's own sources import by. Keeping their spelling
    // means a component pasted from upstream needs no edit to compile.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Tauri serves the built assets from disk; a relative base keeps the
  // same build working in a browser and inside the shell.
  base: "./",
  build: {
    // The probe is built alongside the app only when asked for. Production
    // asset loading is the thing that differs from the dev server, so a
    // probe that only ever runs under `vite dev` cannot see the bugs that
    // live there.
    rollupOptions: process.env.PROBE
      ? { input: { index: "index.html", probe: "probe/index.html" } }
      : undefined,
    outDir: "dist",
    emptyOutDir: true,
    // Monaco is ~3.3 MB and lands in its own chunk, fetched only when a
    // file is opened — the cockpit screen stays around 200 kB. The warning
    // is right about the number and wrong about the consequence, and a
    // warning that fires on every build is one people stop reading.
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcovonly"],
      include: ["src/**"],
    },
  },
});

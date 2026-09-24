// Builds the lab as a single self-contained page for publishing as a preview.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  define: { "import.meta.env.VITE_PREVIEW": JSON.stringify("1"), "import.meta.env.VITE_STATIC": JSON.stringify("1") },
  build: {
    outDir: resolve(process.env.PREVIEW_OUT ?? "dist-preview"),
    emptyOutDir: true,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { input: resolve(process.env.PREVIEW_ENTRY ?? "web/lab-preview.html"), output: { inlineDynamicImports: true } },
  },
});

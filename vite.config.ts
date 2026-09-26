import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const API = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: { input: { main: resolve("web/index.html"), lab: resolve("web/lab.html"), stats: resolve("web/stats.html") } },
  },
  server: {
    port: 5173,
    // Public demo through Tailscale Funnel (`tailscale funnel 5173`). Funnel
    // proxies to 127.0.0.1, but on macOS Vite's default "localhost" binds only
    // ::1 → 502. Bind IPv4 explicitly; browsers opening localhost fall back to it.
    host: "127.0.0.1",
    // Vite rejects unknown Host headers; allow tailnet names.
    allowedHosts: [".ts.net"],
    proxy: {
      "/api": API,
      "/ws": { target: API.replace("http", "ws"), ws: true },
    },
  },
});

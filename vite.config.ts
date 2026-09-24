import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": API,
      "/ws": { target: API.replace("http", "ws"), ws: true },
    },
  },
});

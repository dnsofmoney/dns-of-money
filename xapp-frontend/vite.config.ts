import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // bind 0.0.0.0 so ngrok/cloudflared tunnels can reach it
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Xaman WebView is modern Safari/Chrome — ES2020 is safe.
    target: "es2020",
  },
});

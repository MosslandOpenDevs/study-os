/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-time API proxy so the web app can call /api/* against the local
    // Fastify server (pnpm dev runs both).
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  test: {
    environment: "jsdom",
    // Required for @testing-library/react auto-cleanup between tests.
    globals: true,
  },
});

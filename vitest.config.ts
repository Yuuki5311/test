import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Avoid loading Next.js postcss.config.mjs (string plugins break Vite/Vitest)
  css: { postcss: { plugins: [] } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});

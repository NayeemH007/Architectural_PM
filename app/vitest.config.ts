import { defineConfig } from "vitest/config";
import path from "path";

// Isolated from vite.config.ts so the prototype build/dev path is untouched.
// Slice 2a is a pure data-shape ledger (no React render) → node env, no jsdom,
// no RTL. The ProvenancePopover render is a MANUAL screenshot gate (see
// backend/spike/SLICE-2A-CONTRACT.md §C), not a unit test.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    // do not let vitest try to crawl the playwright e2e or node_modules
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});

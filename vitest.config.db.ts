import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.dbtest.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    globalSetup: ["./src/server/__tests__/db-test-setup.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

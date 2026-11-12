import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@database": path.resolve(__dirname, "database"), "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/security/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});

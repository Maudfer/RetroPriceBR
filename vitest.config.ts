import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/test/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: resolve(__dirname, "coverage")
    }
  },
  resolve: {
    alias: {
      "@retroprice/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@retroprice/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@retroprice/db": resolve(__dirname, "packages/db/src/index.ts")
    }
  }
});

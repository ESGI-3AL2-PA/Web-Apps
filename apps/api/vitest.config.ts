import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.config.ts",
        "src/index.ts",
        "src/entities/**",
        "src/scripts/**",
        "**/dist/**",
      ],
      // Floors sit just below the currently measured coverage so they only ever
      // ratchet up. Raise them as more tests land; never lower them.
      thresholds: {
        lines: 3,
        statements: 3,
        functions: 1,
        branches: 5,
      },
    },
  },
});

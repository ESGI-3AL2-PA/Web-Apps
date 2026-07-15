import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.config.ts", "index.ts", "**/dist/**"],
      // Floors sit just below the currently measured coverage so they only ever
      // ratchet up. Raise them as more tests land; never lower them.
      thresholds: {
        lines: 8,
        statements: 9,
        functions: 11,
        branches: 13,
      },
    },
  },
});

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
        "src/seed-superadmin.ts",
        "src/entities/**",
        "src/scripts/**",
        "src/login-page/**",
        "src/register-page/**",
        "**/dist/**",
      ],
      // Floors sit just below the currently measured coverage so they only ever
      // ratchet up. Raise them as more tests land; never lower them.
      thresholds: {
        lines: 5,
        statements: 5,
        functions: 3,
        branches: 4,
      },
    },
  },
});

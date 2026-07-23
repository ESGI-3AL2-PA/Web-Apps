// Config Vitest de l'auth-service : périmètre des tests et seuils de couverture.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // N'exécute que les fichiers *.test.ts sous src/.
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      // Exclus de la mesure : tests, configs, points d'entrée, seed, entities,
      // scripts, pages HTML login/register, et tout dist/.
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
      // Planchers placés juste sous la couverture mesurée : ils ne font que
      // monter au fil des tests ajoutés. On les relève, jamais on ne les baisse.
      thresholds: {
        lines: 5,
        statements: 5,
        functions: 3,
        branches: 4,
      },
    },
  },
});

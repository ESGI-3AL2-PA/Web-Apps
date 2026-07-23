// Config Vitest de l'app api : où sont les tests et comment mesurer la couverture.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      // Exclus de la couverture : tests, configs, point d'entrée, entités (types purs)
      // et scripts one-shot — du code sans logique à tester, qui fausserait les ratios.
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.config.ts",
        "src/index.ts",
        "src/entities/**",
        "src/scripts/**",
        "**/dist/**",
      ],
      // Ces planchers sont posés juste sous la couverture mesurée actuellement : ils ne
      // peuvent donc que remonter (cliquet). À relever quand des tests s'ajoutent, jamais à baisser.
      thresholds: {
        lines: 3,
        statements: 3,
        functions: 1,
        branches: 5,
      },
    },
  },
});

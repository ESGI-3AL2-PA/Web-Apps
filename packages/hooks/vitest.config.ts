// Config Vitest du package hooks : environnement DOM simulé, périmètre des tests et
// seuils de couverture à effet cliquet (ne peuvent que monter).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom : simule le DOM du navigateur, requis car les hooks touchent window/atob/fetch.
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["**/*.{ts,tsx}"],
      // On exclut de la mesure les tests eux-mêmes, les fichiers de config, le baril index.ts
      // (pur ré-export) et le build compilé.
      exclude: ["**/*.test.{ts,tsx}", "**/*.config.ts", "index.ts", "**/dist/**"],
      // Les planchers sont fixés juste en dessous de la couverture mesurée actuellement,
      // pour ne jamais faire que grimper (cliquet). Les remonter à mesure que des tests
      // arrivent ; ne jamais les abaisser.
      thresholds: {
        lines: 8,
        statements: 9,
        functions: 11,
        branches: 13,
      },
    },
  },
});

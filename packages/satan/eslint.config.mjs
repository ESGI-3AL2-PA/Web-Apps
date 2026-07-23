// Config ESLint du package satan : réutilise le preset Node du monorepo et
// active le type-checking basé sur le tsconfig local (requis par la règle
// no-floating-promises et consorts).
import nodeConfig from "@repo/eslint-config/node.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist", "eslint.config.mjs", "smoke.mts"] }, nodeConfig, {
  languageOptions: {
    parserOptions: {
      // Lint typé : résout le tsconfig le plus proche à partir de ce dossier.
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

// Config ESLint de l'auth-service : reprend le preset Node partagé et active le
// type-checking (parserOptions.project) ancré sur ce dossier.
import nodeConfig from "@repo/eslint-config/node.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist", "eslint.config.mjs", "vitest.config.ts"] }, nodeConfig, {
  languageOptions: {
    parserOptions: {
      // `project: true` : ESLint lit le tsconfig le plus proche pour les règles typées.
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

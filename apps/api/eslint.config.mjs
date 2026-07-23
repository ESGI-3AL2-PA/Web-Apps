// Config ESLint de l'api : preset Node partagé + type-checking projet, avec une
// exception pour les scripts CLI.
import nodeConfig from "@repo/eslint-config/node.js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Fichiers hors périmètre du lint (sortie de build + configs elles-mêmes).
  { ignores: ["dist", "eslint.config.mjs", "vitest.config.ts"] },
  nodeConfig,
  {
    languageOptions: {
      parserOptions: {
        // Active les règles typées en résolvant le tsconfig depuis ce dossier.
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Scripts CLI de seed : la sortie console EST l'interface voulue, on lève no-console.
    files: ["src/scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
);

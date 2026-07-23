// Config ESLint de base partagée par tout le monorepo (flat config).
// Combine les recommandations JS + TypeScript, puis désactive les règles de
// style qui entrent en conflit avec Prettier. Les presets node.js / react.js
// l'étendent avec les globals et règles propres à leur environnement.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(js.configs.recommended, tseslint.configs.recommended, prettierConfig, {
  rules: {
    // Force `import type` pour les imports purement typés.
    "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
    // Les vars/args non utilisés sont tolérés s'ils sont préfixés par `_`.
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    // Seuls console.warn / console.error sont autorisés.
    "no-console": ["warn", { allow: ["warn", "error"] }],
    // Les assertions non-null (`!`) sont autorisées dans ce projet.
    "@typescript-eslint/no-non-null-assertion": "off",
  },
});

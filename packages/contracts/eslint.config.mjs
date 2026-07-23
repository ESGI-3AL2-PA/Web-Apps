// Config ESLint du package @repo/contracts. Active le lint typé (type-aware) en
// pointant le parser sur le tsconfig local ; on ignore le build et ce fichier de config.
import baseConfig from "@repo/eslint-config/base.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist", "eslint.config.mjs"] }, baseConfig, {
  languageOptions: {
    parserOptions: {
      // `project: true` fait résoudre le tsconfig le plus proche du fichier analysé.
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

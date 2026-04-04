import baseConfig from "@repo/eslint-config/base.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist", "eslint.config.mjs"] }, baseConfig, {
  languageOptions: {
    parserOptions: {
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

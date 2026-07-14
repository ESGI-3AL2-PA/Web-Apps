import nodeConfig from "@repo/eslint-config/node.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist", "eslint.config.mjs"] }, nodeConfig, {
  languageOptions: {
    parserOptions: {
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

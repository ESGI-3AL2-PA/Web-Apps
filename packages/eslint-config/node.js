import globals from "globals";
import tseslint from "typescript-eslint";
import baseConfig from "./base.js";

export default tseslint.config(baseConfig, {
  languageOptions: {
    globals: globals.node,
  },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
  },
});

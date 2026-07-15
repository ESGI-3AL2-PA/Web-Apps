import nodeConfig from "@repo/eslint-config/node.js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "eslint.config.mjs", "vitest.config.ts"] },
  nodeConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // CLI seed script: console output is the intended interface.
    files: ["src/scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
);

// Root config — used by IDEs at the monorepo root.
// Each package has its own eslint.config.mjs for CI/turbo linting.
import baseConfig from "@repo/eslint-config/base.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"] }, baseConfig);

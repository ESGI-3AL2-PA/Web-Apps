// Config ESLint du package @repo/config : reprend la config partagée du monorepo
// et ignore uniquement la sortie de build locale.
import baseConfig from "@repo/eslint-config/base.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist"] }, baseConfig);

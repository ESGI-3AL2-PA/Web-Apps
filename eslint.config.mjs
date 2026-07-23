// Config ESLint racine — utilisée par les IDE à la racine du monorepo.
// Chaque package possède son propre eslint.config.mjs pour le lint CI/turbo.
import baseConfig from "@repo/eslint-config/base.js";
import tseslint from "typescript-eslint";

// On ignore les sorties de build, les dépendances et le cache turbo à la racine.
export default tseslint.config({ ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"] }, baseConfig);

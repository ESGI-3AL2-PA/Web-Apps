// Config ESLint (flat) de l'admin-front : reprend la config React partagee du monorepo
// (@repo/eslint-config/react.js) et ignore le dossier de build `dist`.
import reactConfig from "@repo/eslint-config/react.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist"] }, reactConfig);

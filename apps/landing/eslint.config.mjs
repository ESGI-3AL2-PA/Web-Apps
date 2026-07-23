// Config ESLint (flat config) de la landing : reprend le preset React partagé
// et ignore le dossier de build dist/.
import reactConfig from "@repo/eslint-config/react.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist"] }, reactConfig);

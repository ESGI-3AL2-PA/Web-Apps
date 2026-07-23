// Config ESLint du front utilisateur : réutilise le preset React partagé du
// repo et ignore le dossier de build `dist`.
import reactConfig from "@repo/eslint-config/react.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist"] }, reactConfig);

// Config ESLint (flat config) du package hooks : applique le preset React partagé du monorepo.
import reactConfig from "@repo/eslint-config/react.js";
import tseslint from "typescript-eslint";

// Premier bloc : ignore le dossier de build `dist`. Second bloc : les règles React partagées.
export default tseslint.config({ ignores: ["dist"] }, reactConfig);

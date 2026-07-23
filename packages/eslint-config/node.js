// Preset ESLint pour les apps Node (api, auth-service) : config de base +
// globals Node + interdiction des promesses non attendues.
import globals from "globals";
import tseslint from "typescript-eslint";
import baseConfig from "./base.js";

export default tseslint.config(baseConfig, {
  languageOptions: {
    globals: globals.node,
  },
  rules: {
    // Toute promesse doit être await/catch/void — évite les rejets silencieux.
    "@typescript-eslint/no-floating-promises": "error",
  },
});

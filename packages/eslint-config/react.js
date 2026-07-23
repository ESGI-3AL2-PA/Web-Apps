// Preset ESLint pour les fronts React (admin-front, user-front, landing) :
// config de base + recommandations React, hooks, react-refresh, globals navigateur.
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";
import baseConfig from "./base.js";

export default tseslint.config(baseConfig, reactPlugin.configs.flat.recommended, {
  plugins: {
    "react-hooks": reactHooksPlugin,
    "react-refresh": reactRefreshPlugin,
  },
  languageOptions: {
    globals: globals.browser,
    parserOptions: {
      // Active le parsing du JSX.
      ecmaFeatures: { jsx: true },
    },
  },
  settings: {
    // Détecte automatiquement la version de React installée.
    react: { version: "detect" },
  },
  rules: {
    // Règles des hooks : appel conditionnel interdit, deps signalées.
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // JSX transform moderne : plus besoin d'importer React dans le scope.
    "react/react-in-jsx-scope": "off",
    // Fast Refresh : un module ne doit exporter que des composants (les
    // constantes restent tolérées) pour que le hot reload fonctionne.
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
});

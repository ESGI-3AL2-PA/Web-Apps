import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Config Vite de user-front (React + Tailwind 4). Le port est piloté par l'env avec
// une valeur par défaut raisonnable : process.env l'emporte (compose fixe un port
// interne en Docker), sinon on retombe sur le .env à la racine du repo, puis le défaut.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  // Charge toutes les variables du .env racine (préfixe "" = pas de filtre VITE_).
  const env = loadEnv(mode, repoRoot, "");
  const port = Number(process.env.USER_PORT ?? env.USER_PORT) || 5000;

  return {
    plugins: [react(), tailwindcss()],
    server: { port },
    preview: { port },
  };
});

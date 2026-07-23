/**
 * Configuration Vite de la landing page (React + Tailwind).
 * Le port d'écoute (dev et preview) est piloté par variable d'environnement,
 * avec repli sur 6060.
 */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Racine du monorepo, d'où sont chargées les variables d'environnement.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  // Priorité au port : process.env (compose fixe le port interne en Docker),
  // puis le .env à la racine du repo, puis la valeur par défaut 6060.
  const port = Number(process.env.LANDING_PORT ?? env.LANDING_PORT) || 6060;

  return {
    plugins: [react(), tailwindcss()],
    server: { port },
    preview: { port },
  };
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Config Vite de l'admin-front (React + Tailwind 4).
// Le port est piloté par l'environnement avec un défaut raisonnable : process.env
// l'emporte (en Docker, compose fixe un port interne), sinon on retombe sur le
// .env de la racine du repo, puis sur la valeur par défaut (4000).
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  // Charge les variables du .env racine (préfixe "" = toutes, pas seulement VITE_).
  const env = loadEnv(mode, repoRoot, "");
  const port = Number(process.env.ADMIN_PORT ?? env.ADMIN_PORT) || 4000;

  return {
    plugins: [react(), tailwindcss()],
    // Même port pour le serveur de dev et la preview de build.
    server: { port },
    preview: { port },
  };
});

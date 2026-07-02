import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Ports are env-driven with a sane default. process.env wins (compose sets a
// fixed internal port in Docker); otherwise fall back to the repo-root .env,
// then the default.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const port = Number(process.env.USER_PORT ?? env.USER_PORT) || 5000;

  return {
    plugins: [react(), tailwindcss()],
    server: { port },
    preview: { port },
  };
});

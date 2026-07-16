import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// In non-production, load a repo-root .env so dev toggles work without exporting
// vars by hand. Resolved relative to this file (../../../ → repo root), so it
// behaves the same whether run via turbo (cwd = package) or Docker (cwd = /app):
// this compiles to packages/server-kit/dist/load-env.js, which is three levels
// below the repo root — the same depth as the old apps/<app>/src/load-env.ts.
// No-op if the file is absent. Import this for its side effect FIRST in index.ts
// (`import "@repo/server-kit/load-env"`) so the vars are present before any module
// reads process.env.
if (process.env.NODE_ENV !== "production" && typeof process.loadEnvFile === "function") {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

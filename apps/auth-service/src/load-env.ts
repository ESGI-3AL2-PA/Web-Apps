import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// In non-production, load a repo-root .env so dev toggles work without exporting
// vars by hand. Resolved relative to this file (../../../ → repo root), so it
// behaves the same whether run via turbo (cwd = package) or Docker (cwd = /app).
// No-op if the file is absent. Must be the FIRST import in index.ts so the vars
// are present before any module reads process.env.
if (process.env.NODE_ENV !== "production" && typeof process.loadEnvFile === "function") {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

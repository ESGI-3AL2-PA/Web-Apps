import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fichier de configuration (couche « chargement d'environnement »).
// Hors production, charge le .env situé à la racine du dépôt afin que les
// bascules de dev fonctionnent sans exporter les variables à la main. Le chemin
// est résolu relativement à ce fichier (../../../ → racine du dépôt), donc le
// comportement est identique qu'on lance via turbo (cwd = package) ou Docker
// (cwd = /app) : ce module compile vers packages/shared/dist/load-env.js, soit
// trois niveaux sous la racine — la même profondeur que l'ancien
// apps/<app>/src/load-env.ts.
// Ne fait rien si le fichier est absent. À importer POUR SON EFFET DE BORD, en
// PREMIER dans index.ts (`import "@repo/shared/load-env"`), pour que les
// variables soient présentes avant que tout autre module ne lise process.env.
if (process.env.NODE_ENV !== "production" && typeof process.loadEnvFile === "function") {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

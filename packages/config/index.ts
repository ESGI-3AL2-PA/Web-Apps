/// <reference types="vite/client" />

// Configuration runtime centralisée des frontends. Les URLs des services sont lues
// depuis les variables d'env Vite une seule fois ici, pour qu'aucune app ne les
// code en dur ni ne les redérive. Les deux frontends importent `config` au lieu de
// lire `import.meta.env` eux-mêmes.

/** Ensemble des URLs de base publiques des services de la plateforme. */
export interface AppConfig {
  /** URL de base publique de l'auth-service (login/register/JWKS, refresh). */
  authServiceUrl: string;
  /** URL de base publique de l'api. */
  apiUrl: string;
  /** URL de base publique de l'app utilisateur (cible de redirection post-auth). */
  appUrl: string;
  /** URL de base publique de la console d'admin (cible de redirection des superAdmins). */
  adminUrl: string;
  /** URL de base publique du site vitrine ("retour à l'accueil"). */
  landingUrl: string;
}

/** Config résolue : valeur de l'env Vite si présente, sinon repli sur localhost. */
export const config: AppConfig = {
  authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL ?? "http://localhost:3001",
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  appUrl: import.meta.env.VITE_APP_URL ?? "http://localhost:5000",
  adminUrl: import.meta.env.VITE_ADMIN_URL ?? "http://localhost:4000",
  landingUrl: import.meta.env.VITE_LANDING_URL ?? "http://localhost:6060",
};

/// <reference types="vite/client" />

// Centralized frontend runtime configuration. Service URLs are read from Vite
// env vars exactly once here, so apps never hardcode or re-derive them. Both
// frontends import `config` instead of reading `import.meta.env` themselves.

export interface AppConfig {
  /** Public base URL of the auth-service (login/register/JWKS, refresh). */
  authServiceUrl: string;
  /** Public base URL of the api. */
  apiUrl: string;
}

export const config: AppConfig = {
  authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL ?? "http://localhost:3001",
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
};

// Point d'entrée public du package @repo/hooks : regroupe les primitives d'authentification
// partagées par les fronts (admin, user). N'expose que la surface destinée aux consommateurs
// externes — les helpers internes (bootstrapCsrf, getJwtExpiry, etc.) restent privés au package.
export { AuthProvider, useAuth, LoginChallengeError, type AuthUser } from "./useAuth";
export { ProtectedRoute } from "./ProtectedRoute";
export { isTokenExpiringSoon } from "./jwtExpiry";

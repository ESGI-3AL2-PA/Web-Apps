// Contrat partagé (couche « auth / JWT »). Constantes et formes de claims des
// access tokens, partagées entre le signataire et le vérificateur.
import type { UserRole } from "./user-document.js";

/**
 * Contrat de l'access token partagé par le signataire (auth-service
 * `issue-tokens.ts`) et le vérificateur (api `auth.middleware.ts`). Ils vivent dans
 * des apps différentes et avaient chacun codé en dur ces valeurs ainsi que le jeu
 * de clés de claims ; un claim renommé/ajouté ne se voyait qu'à l'exécution. Le
 * *code* signataire/vérificateur reste séparé (c'est voulu) ; seul le contrat est
 * partagé.
 */
export const TOKEN_ISSUER = "auth-service";
export const TOKEN_ALG = "RS256";
/** Audience émise pour un access token d'utilisateur normal. */
export const TOKEN_AUDIENCE = "api";
/** Audience émise pour le token de service interne, éphémère (flux d'inscription). */
export const TOKEN_AUDIENCE_INTERNAL = "api:internal";
/** Audience émise pour un token step-up : preuve d'un TOTP frais pour une opération sensible. */
export const TOKEN_AUDIENCE_STEP_UP = "step-up";
/** Audience émise pour le ticket de la cérémonie d'enrôlement obligatoire (login prod sans TOTP). */
export const TOKEN_AUDIENCE_ENROLL = "enroll";

/** Claims personnalisés portés par un access token, en plus des claims standard `sub`/`iss`/`aud`/`iat`/`exp`. */
export interface AccessTokenClaims {
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** Quartier administré par cet utilisateur (rôle admin uniquement) ; null sinon. */
  adminDistrictId: string | null;
}

/**
 * Claims personnalisés portés par un token step-up — preuve que le porteur a
 * ressaisi un code TOTP frais il y a quelques instants, autorisant une opération
 * sensible. Signé avec la même clé que l'access token pour que l'api puisse le
 * valider via le même JWKS.
 */
export interface StepUpClaims {
  /** Méthodes d'authentification satisfaites ; toujours `["otp"]` ici. */
  amr: string[];
  /** Secondes Unix auxquelles le second facteur a été vérifié. */
  auth_time: number;
}

import { z } from "zod";

/**
 * Formes réseau du login de l'app desktop par authorization code + PKCE.
 *
 * Ces endpoints ne passent pas par un contrat ts-rest : /authorize répond en 302 et
 * /token prend de l'application/x-www-form-urlencoded, deux choses que ts-rest ne
 * modélise pas, et aucun client TypeScript ne les appelle (le consommateur est l'app
 * JavaFX). Les schémas restent malgré tout ici pour que la validation des requêtes ait
 * une source unique, comme le reste du workspace.
 */

/** RFC 7636 §4.1 : le verifier fait 43-128 caractères, et le challenge S256 est son empreinte base64url. */
const PKCE_LENGTH = { min: 43, max: 128 } as const;

/** Query de /authorize : paramètres OAuth d'autorisation + challenge PKCE. */
export const DesktopAuthorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(64),
  redirect_uri: z.string().min(1).max(512),
  state: z.string().min(1).max(256),
  code_challenge: z.string().min(PKCE_LENGTH.min).max(PKCE_LENGTH.max),
  // S256 uniquement. La RFC 7636 définit aussi "plain", qui n'offre aucune protection
  // face à un processus local capable de lire la requête d'autorisation.
  code_challenge_method: z.literal("S256"),
  // Indice de ré-authentification façon OIDC. "login" force à ressaisir les identifiants
  // même quand le navigateur détient encore un cookie de session /auth valide — sans lui
  // le client desktop ne pourrait jamais changer de compte, puisque le logout ne vide que
  // l'état côté JVM.
  prompt: z.enum(["login"]).optional(),
});

// Corps de /token : échange du code d'autorisation contre un access token, avec le
// code_verifier PKCE que le serveur re-hache pour valider le challenge initial.
export const DesktopTokenRequestSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1).max(256),
  redirect_uri: z.string().min(1).max(512),
  client_id: z.string().min(1).max(64),
  code_verifier: z.string().min(PKCE_LENGTH.min).max(PKCE_LENGTH.max),
});

// Réponse de /token : access token Bearer (aud "api") + durée de validité en secondes.
export const DesktopTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
});

export type DesktopAuthorizeQuery = z.infer<typeof DesktopAuthorizeQuerySchema>;
export type DesktopTokenRequest = z.infer<typeof DesktopTokenRequestSchema>;
export type DesktopTokenResponse = z.infer<typeof DesktopTokenResponseSchema>;

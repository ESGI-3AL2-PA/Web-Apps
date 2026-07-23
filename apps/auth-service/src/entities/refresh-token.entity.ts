/**
 * Entité (schéma zod) : refresh token persistant d'une session de connexion.
 *
 * Stocké en hash ; chaque rotation crée une nouvelle ligne partageant le `sessionId`
 * de la famille. Porte les métadonnées de session (User-Agent, IP, dernier usage) qui
 * alimentent la vue « sessions actives » et la détection de réutilisation.
 */
import { z } from "zod";

export const RefreshTokenSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tokenHash: z.string(),
  expiresAt: z.string().datetime(),
  // Même instant que `expiresAt`, stocké en Date BSON uniquement pour piloter l'index
  // TTL Mongo (le moniteur TTL ignore les dates en string). Optionnel/nullable pour que
  // les lignes créées avant ce champ valident toujours ; toute la logique applicative
  // continue d'utiliser `expiresAt`.
  expiresAtDate: z.date().nullish(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  // Identifiant stable de la famille d'une session. Émis au login, conservé à chaque
  // rotation, donc tous les tokens successifs d'un même appareil le partagent. La
  // détection de réutilisation et la vue « sessions actives » révoquent/identifient par
  // famille, pas par utilisateur entier. Nullable pour les lignes créées avant ce champ.
  sessionId: z.string().nullable().default(null),
  // Identité de la session, capturée au login et conservée à travers les rotations pour
  // qu'une session reste reconnaissable dans la vue « sessions actives ». Nullable pour
  // les lignes créées avant ces champs.
  userAgent: z.string().nullable().default(null),
  ip: z.string().nullable().default(null),
  lastUsedAt: z.string().datetime().nullable().default(null),
});

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;

import type { RefreshToken } from "../../entities/refresh-token.entity.js";

/**
 * Repository des refresh tokens (une ligne = une session). Tokens stockés hachés en sha256.
 * Chaque rotation crée une nouvelle ligne rattachée à une même famille de session
 * (sessionId) ; la révocation et la détection de réutilisation s'appuient sur cette famille.
 * Les lignes conservent l'historique IP / User-Agent, d'où les opérations dédiées au RGPD.
 */
export interface IRefreshTokenRepository {
  create(data: Omit<RefreshToken, "id">): Promise<RefreshToken>;
  findActiveByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Réclame (révoque) atomiquement un token actif et retourne sa pré-image. Null s'il
  // n'était pas actif — clôt la course de rotation pour qu'un seul refresh concurrent gagne.
  claimByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Recherche indépendamment du statut de révocation — sert à détecter la réutilisation
  // d'un token déjà tourné (signal de compromission).
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Sessions actives (non révoquées, non expirées) pour la vue « sessions actives ».
  findActiveByUserId(userId: string): Promise<RefreshToken[]>;
  // Toutes les lignes de session d'un utilisateur pas encore purgées par le TTL, actives ou
  // révoquées — l'historique IP / User-Agent / horodatages conservé pour l'export RGPD.
  listAllForUser(userId: string): Promise<RefreshToken[]>;
  revokeByTokenHash(tokenHash: string): Promise<boolean>;
  // Révoque une session par id, restreinte à son propriétaire. false si introuvable / pas la sienne.
  revokeById(id: string, userId: string): Promise<boolean>;
  // Révoque une famille de session entière (toutes les rotations d'un même login). `userId`
  // la restreint à l'appelant quand l'action est initiée par l'utilisateur ; à omettre pour
  // la détection interne de réutilisation.
  revokeBySessionId(sessionId: string, userId?: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
  // Supprime physiquement toutes les lignes de session d'un utilisateur (effacement RGPD) —
  // contrairement à revokeAllForUser, retire les documents et purge l'historique IP/User-Agent.
  deleteAllForUser(userId: string): Promise<void>;
  // Backfill RGPD ponctuel (limitation de conservation) : pose expiresAtDate (createdAt + 7j)
  // sur les anciennes lignes qui en manquent pour que l'index TTL les récupère. Idempotent ;
  // retourne le nombre de lignes modifiées.
  backfillMissingExpiresAtDate(): Promise<number>;
}

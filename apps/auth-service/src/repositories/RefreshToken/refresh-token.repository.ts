import type { RefreshToken } from "../../entities/refresh-token.entity.js";

export interface IRefreshTokenRepository {
  create(data: Omit<RefreshToken, "id">): Promise<RefreshToken>;
  findActiveByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Atomically claim (revoke) an active token, returning its pre-image. Null if it
  // wasn't active — closes the rotation race so only one concurrent refresh wins.
  claimByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Lookup regardless of revoked status — used to detect reuse of a rotated token.
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Active (non-revoked, non-expired) sessions for the "active sessions" view.
  findActiveByUserId(userId: string): Promise<RefreshToken[]>;
  // Every (not-yet-TTL-purged) session row for a user, active or revoked — the
  // retained IP/User-Agent/timestamp history for the GDPR data export.
  listAllForUser(userId: string): Promise<RefreshToken[]>;
  revokeByTokenHash(tokenHash: string): Promise<boolean>;
  // Revoke one session by id, scoped to its owner. Returns false if not found/not theirs.
  revokeById(id: string, userId: string): Promise<boolean>;
  // Revoke a whole session family (all rotations of one login). `userId` scopes it
  // to the caller when the call is user-initiated; omit for internal reuse-detection.
  revokeBySessionId(sessionId: string, userId?: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
  // Hard-delete every session row for a user (GDPR erasure) — unlike revokeAllForUser
  // this removes the rows outright, purging the retained IP/User-Agent history.
  deleteAllForUser(userId: string): Promise<void>;
  // One-time GDPR storage-limitation backfill: set expiresAtDate (createdAt + 7d) on
  // legacy rows missing it so the TTL index reaps them. Idempotent; returns rows touched.
  backfillMissingExpiresAtDate(): Promise<number>;
}

// Cas d'usage : liste les sessions actives de l'utilisateur pour la vue « appareils
// connectés », une ligne par famille de session, en marquant la session courante.
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

/** Vue d'une session exposée à l'utilisateur ; `id` est l'ID de famille (stable), `current` marque l'appareil courant. */
export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
}

/**
 * Liste les sessions actives de l'utilisateur, une ligne par famille de session. `currentHash`
 * est le sha256 du refresh cookie de l'appelant (ou null), utilisé pour marquer la session
 * « cet appareil ». L'`id` renvoyé est l'ID de famille, pour que la révocation survive à la
 * rotation des tokens (l'ID du token change à chaque refresh).
 */
export const listSessionsUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (userId: string, currentHash: string | null): Promise<SessionView[]> => {
    const active = await refreshTokenRepo.findActiveByUserId(userId);
    // Réduit une famille à une seule ligne (une rotation peut laisser momentanément deux
    // tokens actifs). findActiveByUserId trie du plus récent au plus ancien, donc le premier
    // token vu par famille est celui à conserver.
    const byFamily = new Map<string, SessionView>();
    for (const s of active) {
      // Clé de regroupement : l'ID de famille de session, ou l'ID du token pour les anciens tokens sans sessionId.
      const key = s.sessionId ?? s.id;
      const view: SessionView = {
        id: key,
        userAgent: s.userAgent ?? null,
        ip: s.ip ?? null,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt ?? null,
        expiresAt: s.expiresAt,
        current: currentHash !== null && s.tokenHash === currentHash,
      };
      const existing = byFamily.get(key);
      if (!existing) byFamily.set(key, view);
      else if (view.current) existing.current = true; // ne pas perdre le marqueur « courant » sur la ligne conservée
    }
    return [...byFamily.values()];
  };
};

import type { DistrictAdmin } from "../../entities/district-admin.entity.js";

/**
 * Interface du repository des administrateurs de quartier (couche persistance).
 *
 * Chaque ligne rattache un utilisateur au rôle d'administrateur d'un quartier
 * donné. Un index composé unique (districtId, userId) garantit qu'un utilisateur
 * ne peut être administrateur qu'une seule fois par quartier.
 */
export interface IDistrictAdminRepository {
  listDistrictAdmins(params: { districtId?: string; userId?: string; page?: number; limit?: number }): Promise<{
    data: DistrictAdmin[];
    total: number;
    page: number;
    limit: number;
  }>;

  getDistrictAdminById(id: string): Promise<DistrictAdmin | null>;

  /** Cherche le rattachement existant pour ce couple (quartier, utilisateur) —
   *  sert à empêcher les doublons avant création. */
  findExisting(districtId: string, userId: string): Promise<DistrictAdmin | null>;

  createDistrictAdmin(data: Omit<DistrictAdmin, "id" | "createdAt">): Promise<DistrictAdmin>;

  deleteDistrictAdmin(id: string): Promise<boolean>;

  /** Garantit la présence de l'index composé unique `(districtId, userId)`. */
  ensureIndexes(): Promise<void>;
}

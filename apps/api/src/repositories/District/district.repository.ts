import type { District, GeoJson } from "../../entities/district.entity.js";

/**
 * Données de mise à jour d'un quartier.
 * `geoJson: null` efface une frontière existante ; le champ omis la laisse intacte.
 */
export type UpdateDistrictData = Partial<Omit<District, "id" | "geoJson">> & { geoJson?: GeoJson | null };

/**
 * Interface du repository des quartiers (couche persistance).
 *
 * Un quartier porte une frontière GeoJSON (indexée 2dsphere) qui sert à
 * rattacher géographiquement un utilisateur à ses quartiers.
 */
export interface IDistrictRepository {
  // Crée l'index 2dsphere qui sous-tend findDistrictsContaining (idempotent).
  ensureIndexes(): Promise<void>;

  // Tous les quartiers dont la géométrie contient le point donné. Les quartiers
  // peuvent se chevaucher, donc un point peut tomber dans plusieurs — l'appelant
  // décide comment lever l'ambiguïté (0 => aucun, 1 => rattachement auto, >1 =>
  // l'utilisateur choisit).
  findDistrictsContaining(point: GeoJson): Promise<District[]>;

  getDistricts(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: District[];
    total: number;
    page: number;
    limit: number;
  }>;

  getDistrictById(id: string): Promise<District | null>;

  createDistrict(data: Omit<District, "id">): Promise<District>;

  updateDistrict(id: string, data: UpdateDistrictData): Promise<District | null>;

  deleteDistrict(id: string): Promise<boolean>;
}

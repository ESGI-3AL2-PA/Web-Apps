import { z } from "zod";

/**
 * Schéma canonique d'un document de la collection partagée `district_admins` (table de
 * jointure entre un utilisateur et le quartier qu'il administre). Lu par les deux
 * backends : l'api en a le CRUD complet, l'auth-service le lit pour résoudre
 * `adminDistrictId` au moment de l'émission du token. Le partage lecture/écriture est
 * volontairement asymétrique ; seuls la forme du document et le nom de la collection
 * sont mutualisés.
 */
export const districtAdminDocumentSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
});

export type DistrictAdminDocument = z.infer<typeof districtAdminDocumentSchema>;

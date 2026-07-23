// Entité de jointure entre User et District — enregistre qu'un utilisateur détient les
// privilèges d'administrateur de quartier sur un quartier précis. Stockée dans la
// collection partagée `district_admins` (index composé unique sur `(districtId, userId)`),
// lue par les deux backends : son schéma est donc l'unique source de vérité dans
// @repo/shared. Ré-exportée sous les noms locaux de l'api pour que les imports existants
// (`DistrictAdmin`, `DistrictAdminSchema`) restent stables.
export {
  districtAdminDocumentSchema as DistrictAdminSchema,
  type DistrictAdminDocument as DistrictAdmin,
} from "@repo/shared";

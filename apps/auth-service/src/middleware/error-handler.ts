// AppError / NotFoundError / errorHandler sont partagés — voir @repo/shared. Ré-exportés
// ici (une seule identité de classe entre les deux backends) pour que les chemins d'import
// locaux restent stables.
export { AppError, NotFoundError, errorHandler } from "@repo/shared";
